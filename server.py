#!/usr/bin/env python3
# =========================================================
# server.py
# Servidor unico do Broken Mirror RPG.
#
# O que faz:
#   - entrega os arquivos do site (HTML, CSS, JS, imagens)
#   - abre o WebSocket em /ws para o multiplayer simples
#
# Como ampliar o numero de pessoas por sala:
#   1) mude MAX_PLAYERS aqui
#   2) mude MAX_PLAYERS em js/data.js
#
# Como rodar:
#   python3 server.py
# Porta: 8000 (altere PORT se precisar)
# =========================================================

from __future__ import annotations

import hashlib
import base64
import json
import os
import re
import socket
import struct
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# ----- CONFIGURE AQUI -----
PORT = 8000
MAX_PLAYERS = 8          # teto por sala (mesmo valor em js/data.js)
MAX_ROOMS = 32           # quantas salas simultaneas o servidor aguenta
MAX_CHAT = 180           # caracteres por mensagem
MAX_NAME = 18
MAX_ROOM = 8
RATE_PER_SEC = 20        # teto de mensagens por segundo por jogador
ROOT = os.path.dirname(os.path.abspath(__file__))
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
# --------------------------

ROOM_OK = re.compile(r"^[A-Z0-9]{1,8}$")
NAME_OK = re.compile(r"^[\w \-'.]{1,18}$", re.UNICODE)
CHAR_OK = {"chindu", "milo", "bigJonh", "void", "mimi", "skatt", "vodoll"}
SEATS = ("GM", "P1", "P2", "P3", "P4", "P5", "P6", "P7")


class Client:
    def __init__(self, sock: socket.socket, addr):
        self.sock = sock
        self.addr = addr
        self.id = f"{addr[0]}-{addr[1]}-{int(time.time() * 1000) % 100000}"
        self.room = None
        self.name = "Jogador"
        self.char_id = "chindu"
        self.x = 0
        self.y = 0
        self.dir = "front"
        self.walk_frame = 0
        self.seated = False
        self.seat_id = None
        self.map_id = "hall"
        self.pose = None
        self.last_msg = 0.0
        self.hits = 0
        self.alive = True

    def public(self):
        return {
            "id": self.id,
            "name": self.name,
            "charId": self.char_id,
            "x": self.x,
            "y": self.y,
            "dir": self.dir,
            "walkFrame": self.walk_frame,
            "seated": self.seated,
            "seatId": self.seat_id,
            "mapId": self.map_id,
            "pose": self.pose,
        }


class Room:
    def __init__(self, code: str):
        self.code = code
        self.clients: dict[str, Client] = {}
        self.seats = {s: None for s in SEATS}
        self.locked = False
        self.turn_seat = None

    def names_in_seats(self):
        out = {s: None for s in SEATS}
        for seat, cid in self.seats.items():
            who = self.clients.get(cid) if cid else None
            out[seat] = who.name if who else None
        return out


rooms: dict[str, Room] = {}
rooms_lock = threading.Lock()


def send_ws(sock: socket.socket, payload: bytes, opcode: int = 1) -> None:
    n = len(payload)
    header = bytearray()
    header.append(0x80 | opcode)
    if n < 126:
        header.append(n)
    elif n < 65536:
        header.append(126)
        header.extend(struct.pack("!H", n))
    else:
        header.append(127)
        header.extend(struct.pack("!Q", n))
    sock.sendall(header + payload)


def send_json(client: Client, obj: dict) -> None:
    if not client.alive:
        return
    try:
        send_ws(client.sock, json.dumps(obj, ensure_ascii=True).encode("utf-8"))
    except OSError:
        client.alive = False


def recv_frame(sock: socket.socket) -> tuple[int, bytes] | None:
    hdr = recvn(sock, 2)
    if not hdr:
        return None
    opcode = hdr[0] & 0x0F
    masked = hdr[1] & 0x80
    n = hdr[1] & 0x7F
    if n == 126:
        ext = recvn(sock, 2)
        if not ext:
            return None
        n = struct.unpack("!H", ext)[0]
    elif n == 127:
        ext = recvn(sock, 8)
        if not ext:
            return None
        n = struct.unpack("!Q", ext)[0]
    if n > 4096:
        return None
    mask = recvn(sock, 4) if masked else b"\x00\x00\x00\x00"
    if mask is None:
        return None
    data = recvn(sock, n) if n else b""
    if data is None:
        return None
    if masked:
        data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    return opcode, data


def recvn(sock: socket.socket, n: int) -> bytes | None:
    buf = bytearray()
    while len(buf) < n:
        try:
            chunk = sock.recv(n - len(buf))
        except OSError:
            return None
        if not chunk:
            return None
        buf.extend(chunk)
    return bytes(buf)


def handshake(sock: socket.socket) -> bool:
    try:
        sock.settimeout(8)
        raw = b""
        while b"\r\n\r\n" not in raw and len(raw) < 4096:
            chunk = sock.recv(1024)
            if not chunk:
                return False
            raw += chunk
        text = raw.decode("iso-8859-1", errors="replace")
        if "Upgrade: websocket" not in text.lower() and "upgrade: websocket" not in text.lower():
            return False
        key = ""
        for line in text.split("\r\n"):
            if line.lower().startswith("sec-websocket-key:"):
                key = line.split(":", 1)[1].strip()
        if not key:
            return False
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode("ascii")).digest()).decode("ascii")
        resp = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n"
            "\r\n"
        )
        sock.sendall(resp.encode("ascii"))
        sock.settimeout(30)
        return True
    except OSError:
        return False


def rate_ok(client: Client) -> bool:
    now = time.time()
    if now - client.last_msg > 1:
        client.last_msg = now
        client.hits = 1
        return True
    client.hits += 1
    return client.hits <= RATE_PER_SEC


def broadcast(room: Room, obj: dict, skip: Client | None = None) -> None:
    dead = []
    for c in list(room.clients.values()):
        if skip and c.id == skip.id:
            continue
        send_json(c, obj)
        if not c.alive:
            dead.append(c)
    for c in dead:
        leave_room(c)


def snapshot_players(room: Room, skip: Client | None = None) -> list:
    return [c.public() for c in room.clients.values() if not skip or c.id != skip.id]


def join_room(client: Client, room_code: str, name: str, char_id: str) -> str | None:
    with rooms_lock:
        if len(rooms) >= MAX_ROOMS and room_code not in rooms:
            return "Servidor cheio. Tente outro codigo daqui a pouco."
        room = rooms.get(room_code)
        if room is None:
            room = Room(room_code)
            rooms[room_code] = room
        if len(room.clients) >= MAX_PLAYERS:
            return "Sala cheia (max. %s)." % MAX_PLAYERS
        client.room = room_code
        client.name = name
        client.char_id = char_id if char_id in CHAR_OK else "chindu"
        room.clients[client.id] = client
        send_json(client, {
            "type": "welcome",
            "id": client.id,
            "count": len(room.clients),
            "max": MAX_PLAYERS,
            "players": snapshot_players(room, client),
            "seats": room.names_in_seats(),
        })
        broadcast(room, {
            "type": "players",
            "count": len(room.clients),
            "max": MAX_PLAYERS,
            "players": snapshot_players(room),
        })
        broadcast(room, {"type": "chat", "name": "Sala", "text": name + " entrou.", "kind": "sys"})
        return None


def leave_room(client: Client) -> None:
    code = client.room
    if not code:
        client.alive = False
        try:
            client.sock.close()
        except OSError:
            pass
        return
    with rooms_lock:
        room = rooms.get(code)
        if not room:
            return
        room.clients.pop(client.id, None)
        for seat, cid in list(room.seats.items()):
            if cid == client.id:
                room.seats[seat] = None
        if not room.clients:
            rooms.pop(code, None)
        else:
            broadcast(room, {
                "type": "players",
                "count": len(room.clients),
                "max": MAX_PLAYERS,
                "players": snapshot_players(room),
            })
            broadcast(room, {"type": "seats", "seats": room.names_in_seats(), "locked": room.locked, "turnSeat": room.turn_seat})
            broadcast(room, {"type": "chat", "name": "Sala", "text": client.name + " saiu.", "kind": "sys"})
    client.alive = False
    try:
        client.sock.close()
    except OSError:
        pass


def handle_msg(client: Client, msg: dict) -> None:
    if not rate_ok(client):
        return
    kind = msg.get("type")
    if kind == "join" and not client.room:
        room = str(msg.get("room") or "").upper()[:MAX_ROOM]
        name = str(msg.get("name") or "Jogador")[:MAX_NAME]
        char_id = str(msg.get("charId") or "chindu")
        if not ROOM_OK.match(room):
            send_json(client, {"type": "error", "reason": "Codigo da sala invalido."})
            return
        if not NAME_OK.match(name):
            send_json(client, {"type": "error", "reason": "Nome invalido."})
            return
        err = join_room(client, room, name, char_id)
        if err:
            send_json(client, {"type": "full", "reason": err})
        return

    if not client.room:
        return
    with rooms_lock:
        room = rooms.get(client.room)
    if not room:
        return

    if kind == "state":
        client.x = int(msg.get("x") or 0)
        client.y = int(msg.get("y") or 0)
        client.dir = str(msg.get("dir") or "front")[:8]
        client.walk_frame = 1 if msg.get("walkFrame") else 0
        client.seated = bool(msg.get("seated"))
        client.seat_id = msg.get("seatId") if msg.get("seatId") in SEATS else None
        client.map_id = str(msg.get("mapId") or "hall")[:12]
        client.pose = str(msg.get("pose") or "")[:12] or None
        broadcast(room, {
            "type": "players",
            "count": len(room.clients),
            "max": MAX_PLAYERS,
            "players": snapshot_players(room),
        }, skip=client)
        return

    if kind == "chat":
        text = str(msg.get("text") or "").strip()[:MAX_CHAT]
        if not text:
            return
        broadcast(room, {"type": "chat", "name": client.name, "text": text, "kind": ""})
        return

    if kind == "dice":
        items = msg.get("items")
        if not isinstance(items, list) or not items or len(items) > 4:
            return
        clean = []
        for it in items[:4]:
            if not isinstance(it, dict):
                continue
            clean.append({
                "id": str(it.get("id") or "d20")[:8],
                "label": str(it.get("label") or "d20")[:6],
                "shape": str(it.get("shape") or "d20")[:6],
                "value": it.get("value"),
                "text": str(it.get("text") or "")[:4],
            })
        if clean:
            # quem rolou ja anima na propria tela; os outros so recebem o resultado
            broadcast(room, {"type": "dice", "name": client.name, "items": clean}, skip=client)
        return

    if kind == "pose":
        pose = str(msg.get("pose") or "")[:12]
        ms = int(msg.get("ms") or 1800)
        client.pose = pose
        broadcast(room, {"type": "pose", "id": client.id, "pose": pose, "ms": ms}, skip=client)
        return

    if kind == "avatar":
        char_id = str(msg.get("charId") or "")
        if char_id in CHAR_OK:
            client.char_id = char_id
        return

    if kind == "sit":
        seat = msg.get("seat")
        if seat not in SEATS:
            return
        with rooms_lock:
            taken = room.seats.get(seat)
            if taken and taken != client.id:
                return
            for s, cid in list(room.seats.items()):
                if cid == client.id:
                    room.seats[s] = None
            room.seats[seat] = client.id
            client.seated = True
            client.seat_id = seat
            broadcast(room, {"type": "seats", "seats": room.names_in_seats(), "locked": room.locked, "turnSeat": room.turn_seat})
        return

    if kind == "stand":
        with rooms_lock:
            for s, cid in list(room.seats.items()):
                if cid == client.id:
                    room.seats[s] = None
            client.seated = False
            client.seat_id = None
            broadcast(room, {"type": "seats", "seats": room.names_in_seats(), "locked": room.locked, "turnSeat": room.turn_seat})
        return

    if kind == "lock":
        if room.seats.get("GM") != client.id:
            return
        room.locked = bool(msg.get("locked"))
        broadcast(room, {"type": "seats", "seats": room.names_in_seats(), "locked": room.locked, "turnSeat": room.turn_seat})
        return

    if kind == "turn":
        if room.seats.get("GM") != client.id:
            return
        seat = msg.get("seat")
        if seat in SEATS:
            room.turn_seat = seat
            broadcast(room, {"type": "seats", "seats": room.names_in_seats(), "locked": room.locked, "turnSeat": room.turn_seat})


def client_loop(sock: socket.socket, addr) -> None:
    client = Client(sock, addr)
    if not handshake(sock):
        try:
            sock.close()
        except OSError:
            pass
        return
    try:
        while client.alive:
            frame = recv_frame(sock)
            if not frame:
                break
            opcode, data = frame
            if opcode == 8:
                break
            if opcode == 9:
                send_ws(sock, data, opcode=10)
                continue
            if opcode != 1:
                continue
            try:
                msg = json.loads(data.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                continue
            if isinstance(msg, dict):
                handle_msg(client, msg)
    finally:
        leave_room(client)


class StaticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        return

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        super().end_headers()


class DualServer(ThreadingHTTPServer):
    daemon_threads = True

    def process_request(self, request, client_address):
        try:
            peek = request.recv(8, socket.MSG_PEEK)
        except OSError:
            request.close()
            return
        if peek[:3] == b"GET":
            try:
                head = request.recv(1024, socket.MSG_PEEK)
            except OSError:
                request.close()
                return
            if b"Upgrade: websocket" in head or b"upgrade: websocket" in head:
                t = threading.Thread(target=client_loop, args=(request, client_address), daemon=True)
                t.start()
                return
        super().process_request(request, client_address)


def main() -> None:
    os.chdir(ROOT)
    httpd = DualServer(("0.0.0.0", PORT), StaticHandler)
    print("Broken Mirror RPG  http://127.0.0.1:%s" % PORT, flush=True)
    print("WebSocket em /ws   max %s jogadores por sala" % MAX_PLAYERS, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# =========================================================
# server.py
# Arquivos do site + multiplayer (WebSocket /ws e HTTP /api).
#
# Ampliar jogadores: MAX_PLAYERS aqui e em js/data.js
# Rodar: python3 server.py
# =========================================================

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import secrets
import socket
import struct
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8000"))
MAX_PLAYERS = 8
MAX_ROOMS = 32
MAX_CHAT = 180
MAX_NAME = 18
MAX_ROOM = 8
RATE_PER_SEC = 24
HTTP_TTL = 12
ROOT = os.path.dirname(os.path.abspath(__file__))
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

ROOM_OK = re.compile(r"^[A-Z0-9]{1,8}$")
NAME_OK = re.compile(r"^[\w \-'.]{1,18}$", re.UNICODE)
CHAR_OK = {"chindu", "milo", "bigJonh", "void", "mimi", "skatt", "vodoll"}
SEATS = ("GM", "P1", "P2", "P3", "P4", "P5", "P6", "P7")


class Client:
    def __init__(self, cid: str, mode: str, sock=None):
        self.id = cid
        self.mode = mode
        self.sock = sock
        self.room = None
        self.name = "Jogador"
        self.char_id = "chindu"
        self.x = 448
        self.y = 422
        self.dir = "front"
        self.walk_frame = 0
        self.seated = False
        self.seat_id = None
        self.map_id = "hall"
        self.pose = None
        self.last_msg = 0.0
        self.hits = 0
        self.alive = True
        self.seen = time.time()
        self.events: list = []

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
        self.last_dice = None

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
    header = bytearray([0x80 | opcode])
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
    if client.mode == "http":
        if len(client.events) < 40:
            client.events.append(obj)
        return
    if not client.alive or not client.sock:
        return
    try:
        send_ws(client.sock, json.dumps(obj, ensure_ascii=True).encode("utf-8"))
    except OSError:
        client.alive = False


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


def recv_frame(sock: socket.socket):
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
    if n > 8192:
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


def rate_ok(client: Client) -> bool:
    now = time.time()
    if now - client.last_msg > 1:
        client.last_msg = now
        client.hits = 1
        return True
    client.hits += 1
    return client.hits <= RATE_PER_SEC


def snapshot_players(room: Room, skip: Client | None = None) -> list:
    return [c.public() for c in room.clients.values() if not skip or c.id != skip.id]


def broadcast(room: Room, obj: dict, skip: Client | None = None) -> None:
    dead = []
    for c in list(room.clients.values()):
        if skip and c.id == skip.id:
            continue
        send_json(c, obj)
        if c.mode == "ws" and not c.alive:
            dead.append(c)
    for c in dead:
        leave_room(c)


def join_room(client: Client, room_code: str, name: str, char_id: str) -> str | None:
    with rooms_lock:
        if len(rooms) >= MAX_ROOMS and room_code not in rooms:
            return "Servidor cheio."
        room = rooms.get(room_code)
        if room is None:
            room = Room(room_code)
            rooms[room_code] = room
        live = [c for c in room.clients.values() if c.mode == "ws" or (time.time() - c.seen) < HTTP_TTL]
        if len(live) >= MAX_PLAYERS:
            return "Sala cheia (max. %s)." % MAX_PLAYERS
        n = len(room.clients)
        client.room = room_code
        client.name = name
        client.char_id = char_id if char_id in CHAR_OK else "chindu"
        client.x = 14 * 32 + (n % 4) * 22
        client.y = 13 * 32 + (n // 4) * 20
        room.clients[client.id] = client
        welcome = {
            "type": "welcome",
            "id": client.id,
            "count": len(room.clients),
            "max": MAX_PLAYERS,
            "players": snapshot_players(room, client),
            "seats": room.names_in_seats(),
            "locked": room.locked,
            "turnSeat": room.turn_seat,
            "x": client.x,
            "y": client.y,
        }
        send_json(client, welcome)
        if client.mode == "http":
            client.events = []
        broadcast(room, {
            "type": "players",
            "count": len(room.clients),
            "max": MAX_PLAYERS,
            "players": snapshot_players(room),
        }, skip=client)
        broadcast(room, {"type": "chat", "name": "Sala", "text": name + " entrou.", "kind": "sys"}, skip=client)
        print("join %s room=%s mode=%s count=%s" % (name, room_code, client.mode, len(room.clients)), flush=True)
        return None


def leave_room(client: Client) -> None:
    code = client.room
    client.alive = False
    if not code:
        if client.sock:
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
            broadcast(room, {
                "type": "seats",
                "seats": room.names_in_seats(),
                "locked": room.locked,
                "turnSeat": room.turn_seat,
            })
            broadcast(room, {"type": "chat", "name": "Sala", "text": client.name + " saiu.", "kind": "sys"})
    if client.sock:
        try:
            client.sock.close()
        except OSError:
            pass


def apply_state(client: Client, msg: dict) -> None:
    client.x = int(msg.get("x") or client.x)
    client.y = int(msg.get("y") or client.y)
    client.dir = str(msg.get("dir") or "front")[:8]
    client.walk_frame = 1 if msg.get("walkFrame") else 0
    client.seated = bool(msg.get("seated"))
    client.seat_id = msg.get("seatId") if msg.get("seatId") in SEATS else None
    client.map_id = str(msg.get("mapId") or "hall")[:12]
    pose = msg.get("pose")
    client.pose = str(pose)[:12] if pose else None
    client.seen = time.time()


def handle_msg(client: Client, msg: dict) -> dict | None:
    if not rate_ok(client):
        return None
    kind = msg.get("type")
    if kind == "join" and not client.room:
        room = str(msg.get("room") or "").upper()[:MAX_ROOM]
        name = str(msg.get("name") or "Jogador")[:MAX_NAME]
        char_id = str(msg.get("charId") or "chindu")
        if not ROOM_OK.match(room):
            return {"type": "error", "reason": "Codigo da sala invalido."}
        if not NAME_OK.match(name):
            return {"type": "error", "reason": "Nome invalido."}
        err = join_room(client, room, name, char_id)
        if err:
            return {"type": "full", "reason": err}
        return None

    if not client.room:
        return {"type": "error", "reason": "Entre numa sala."}
    with rooms_lock:
        room = rooms.get(client.room)
    if not room:
        return {"type": "error", "reason": "Sala sumiu."}

    if kind == "state":
        apply_state(client, msg)
        if client.mode == "ws":
            broadcast(room, {
                "type": "players",
                "count": len(room.clients),
                "max": MAX_PLAYERS,
                "players": snapshot_players(room),
            }, skip=client)
        return None

    if kind == "chat":
        text = str(msg.get("text") or "").strip()[:MAX_CHAT]
        if text:
            broadcast(room, {
                "type": "chat",
                "name": client.name,
                "text": text,
                "kind": "",
                "from": client.id,
            })
        return None

    if kind == "dice":
        items = msg.get("items")
        if not isinstance(items, list) or not items or len(items) > 4:
            return None
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
            payload = {"type": "dice", "name": client.name, "from": client.id, "items": clean}
            room.last_dice = payload
            broadcast(room, payload, skip=client)
        return None

    if kind == "pose":
        pose = str(msg.get("pose") or "")[:12]
        ms = int(msg.get("ms") or 1800)
        client.pose = pose
        broadcast(room, {"type": "pose", "id": client.id, "pose": pose, "ms": ms}, skip=client)
        return None

    if kind == "avatar":
        char_id = str(msg.get("charId") or "")
        if char_id in CHAR_OK:
            client.char_id = char_id
        return None

    if kind == "sit":
        seat = msg.get("seat")
        if seat not in SEATS:
            return None
        with rooms_lock:
            taken = room.seats.get(seat)
            if taken and taken != client.id:
                return None
            for s, cid in list(room.seats.items()):
                if cid == client.id:
                    room.seats[s] = None
            room.seats[seat] = client.id
            client.seated = True
            client.seat_id = seat
            broadcast(room, {
                "type": "seats",
                "seats": room.names_in_seats(),
                "locked": room.locked,
                "turnSeat": room.turn_seat,
            })
        return None

    if kind == "stand":
        with rooms_lock:
            for s, cid in list(room.seats.items()):
                if cid == client.id:
                    room.seats[s] = None
            client.seated = False
            client.seat_id = None
            broadcast(room, {
                "type": "seats",
                "seats": room.names_in_seats(),
                "locked": room.locked,
                "turnSeat": room.turn_seat,
            })
        return None

    if kind == "lock":
        if room.seats.get("GM") != client.id:
            return None
        room.locked = bool(msg.get("locked"))
        broadcast(room, {
            "type": "seats",
            "seats": room.names_in_seats(),
            "locked": room.locked,
            "turnSeat": room.turn_seat,
        })
        return None

    if kind == "turn":
        if room.seats.get("GM") != client.id:
            return None
        seat = msg.get("seat")
        if seat in SEATS:
            room.turn_seat = seat
            broadcast(room, {
                "type": "seats",
                "seats": room.names_in_seats(),
                "locked": room.locked,
                "turnSeat": room.turn_seat,
            })
    return None


def prune_http() -> None:
    now = time.time()
    with rooms_lock:
        stale = []
        for room in list(rooms.values()):
            for c in list(room.clients.values()):
                if c.mode == "http" and now - c.seen > HTTP_TTL:
                    stale.append(c)
        for c in stale:
            leave_room(c)


def ws_session(handler: SimpleHTTPRequestHandler) -> None:
    key = handler.headers.get("Sec-WebSocket-Key", "")
    if not key:
        handler.send_error(400)
        return
    accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode("ascii")).digest()).decode("ascii")
    handler.protocol_version = "HTTP/1.1"
    handler.close_connection = True
    handler.send_response(101, "Switching Protocols")
    handler.send_header("Upgrade", "websocket")
    handler.send_header("Connection", "Upgrade")
    handler.send_header("Sec-WebSocket-Accept", accept)
    handler.end_headers()
    try:
        handler.wfile.flush()
    except OSError:
        return
    sock = handler.connection
    try:
        sock.settimeout(40)
    except OSError:
        pass
    client = Client("w-" + secrets.token_hex(6), "ws", sock)
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
                extra = handle_msg(client, msg)
                if extra:
                    send_json(client, extra)
    finally:
        leave_room(client)


def read_json_body(handler: SimpleHTTPRequestHandler) -> dict | None:
    try:
        n = int(handler.headers.get("Content-Length") or "0")
    except ValueError:
        n = 0
    if n <= 0 or n > 8192:
        return None
    raw = handler.rfile.read(n)
    try:
        data = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def write_json(handler: SimpleHTTPRequestHandler, obj: dict, code: int = 200) -> None:
    body = json.dumps(obj, ensure_ascii=True).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def find_http_client(cid: str) -> Client | None:
    with rooms_lock:
        for room in rooms.values():
            c = room.clients.get(cid)
            if c and c.mode == "http":
                return c
    return None


def http_join(payload: dict) -> dict:
    prune_http()
    client = Client("h-" + secrets.token_hex(6), "http")
    extra = handle_msg(client, {
        "type": "join",
        "room": payload.get("room"),
        "name": payload.get("name"),
        "charId": payload.get("charId"),
    })
    if extra:
        return extra
    with rooms_lock:
        room = rooms.get(client.room)
        players = snapshot_players(room, client) if room else []
        seats = room.names_in_seats() if room else {}
        count = len(room.clients) if room else 1
    return {
        "type": "welcome",
        "id": client.id,
        "count": count,
        "max": MAX_PLAYERS,
        "players": players,
        "seats": seats,
        "locked": room.locked if room else False,
        "turnSeat": room.turn_seat if room else None,
        "x": client.x,
        "y": client.y,
    }


def http_leave(payload: dict) -> dict:
    cid = str(payload.get("id") or "")
    client = find_http_client(cid)
    if client:
        leave_room(client)
    return {"ok": True}


def http_sync(payload: dict) -> dict:
    prune_http()
    cid = str(payload.get("id") or "")
    client = find_http_client(cid)
    if not client:
        return {"type": "error", "reason": "Sessao expirada. Entre de novo."}
    state = payload.get("state")
    if isinstance(state, dict):
        state = dict(state)
        state["type"] = "state"
        handle_msg(client, state)
    incoming = payload.get("events")
    if not isinstance(incoming, list):
        incoming = []
    event = payload.get("event")
    if isinstance(event, dict):
        incoming = [event] + incoming
    seen = set()
    for ev in incoming:
        if not isinstance(ev, dict):
            continue
        kind = ev.get("type")
        if not kind or kind == "state":
            continue
        key = kind + ":" + str(ev.get("text") or ev.get("seat") or ev.get("pose") or "")
        if key in seen:
            continue
        seen.add(key)
        handle_msg(client, ev)
    with rooms_lock:
        room = rooms.get(client.room)
        if not room:
            return {"type": "error", "reason": "Sala sumiu."}
        events = client.events
        client.events = []
        return {
            "type": "sync",
            "id": client.id,
            "count": len(room.clients),
            "max": MAX_PLAYERS,
            "players": snapshot_players(room, client),
            "seats": room.names_in_seats(),
            "locked": room.locked,
            "turnSeat": room.turn_seat,
            "events": events,
        }


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        return

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/ws" and (self.headers.get("Upgrade") or "").lower() == "websocket":
            ws_session(self)
            return
        if path == "/api/health":
            write_json(self, {"ok": True, "max": MAX_PLAYERS})
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        payload = read_json_body(self) or {}
        if path == "/api/join":
            write_json(self, http_join(payload))
            return
        if path == "/api/sync":
            write_json(self, http_sync(payload))
            return
        if path == "/api/leave":
            write_json(self, http_leave(payload))
            return
        self.send_error(404)


def main() -> None:
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("Broken Mirror RPG  http://127.0.0.1:%s" % PORT, flush=True)
    print("WS /ws  HTTP /api/join /api/sync  max %s" % MAX_PLAYERS, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

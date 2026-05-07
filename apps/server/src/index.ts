import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { sandboxRouter } from './sandbox.js';
import { GameRoom } from './gameRoom.js';
import { nanoid } from 'nanoid';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/sandbox', sandboxRouter);

const server = createServer(app);
const wss = new WebSocketServer({ server });

// ── Room registry ─────────────────────────────────────────────────────────────

const rooms = new Map<string, GameRoom>();

function getOrCreateRoom(roomCode: string): GameRoom {
  let room = rooms.get(roomCode);
  if (!room) {
    room = new GameRoom({ playerCount: 2, turnTimerSeconds: 30, seedPhrase: nanoid(32) });
    rooms.set(roomCode, room);
  }
  return room;
}

// Clean up empty rooms every 5 minutes
setInterval(() => {
  for (const [code, room] of rooms) {
    if (room.isEmpty()) rooms.delete(code);
  }
}, 5 * 60 * 1000);

// ── WebSocket handler ─────────────────────────────────────────────────────────

wss.on('connection', (ws: WebSocket) => {
  let roomCode: string | null = null;
  let playerId: string | null = null;

  ws.on('message', (raw) => {
    let msg: { type: string; [k: string]: unknown };
    try { msg = JSON.parse(raw.toString()); }
    catch { return; }

    if (msg.type === 'CREATE_ROOM') {
      roomCode = nanoid(6).toUpperCase();
      playerId = (msg.playerId as string) || nanoid(8);
      const gameMode = (msg.gameMode as string) || 'VS_FREE';
      const room = getOrCreateRoom(roomCode);
      room.setGameMode(gameMode);
      room.addPlayer(ws, playerId, (msg.playerName as string) || 'Player');
      ws.send(JSON.stringify({ type: 'ROOM_CREATED', roomCode, playerId }));
      return;
    }

    if (msg.type === 'JOIN_ROOM') {
      roomCode = (msg.roomCode as string).toUpperCase();
      playerId = (msg.playerId as string) || nanoid(8);
      const room = rooms.get(roomCode);
      if (!room) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
        return;
      }
      room.addPlayer(ws, playerId, (msg.playerName as string) || 'Player');
      ws.send(JSON.stringify({ type: 'ROOM_JOINED', roomCode, playerId }));
      return;
    }

    if (roomCode && playerId) {
      const room = rooms.get(roomCode);
      if (room) room.handleMessage(playerId, msg);
    }
  });

  ws.on('close', () => {
    if (roomCode && playerId) {
      rooms.get(roomCode)?.removePlayer(playerId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[match3d-server] listening on port ${PORT} (HTTP + WS)`);
});

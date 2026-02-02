import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { ConnectedSpectator } from './types';
import { rooms, spectatorConnections, safeSend, getPlayerList } from './state';
import { filterGameStateForSpectator } from './gameSync';
import { log } from '../index';

const DISPLAY_NAME_MAX_LENGTH = 50;

export function handleSpectateRoom(ws: WebSocket, message: any) {
  const { roomCode, displayName } = message;
  const trimmedName = (displayName?.trim?.() || 'Spectator').slice(0, DISPLAY_NAME_MAX_LENGTH);
  const normalizedCode = roomCode?.toUpperCase?.() || '';

  const room = rooms.get(normalizedCode);
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }

  if (!room.gameState) {
    ws.send(JSON.stringify({ type: 'error', message: 'No active game to watch' }));
    return;
  }

  const spectatorId = randomUUID();
  const spectator: ConnectedSpectator = {
    ws,
    roomCode: normalizedCode,
    spectatorId,
    displayName: trimmedName,
  };

  room.spectators.set(spectatorId, spectator);
  spectatorConnections.set(ws, spectator);

  const filteredState = filterGameStateForSpectator(room.gameState);

  ws.send(JSON.stringify({
    type: 'spectating',
    roomCode: normalizedCode,
    spectatorId,
    displayName: trimmedName,
    players: getPlayerList(room),
    gameState: filteredState,
    chatMessages: room.chatMessages,
    spectatorCount: room.spectators.size,
  }));

  broadcastSpectatorCount(room);

  log(`Spectator ${trimmedName} started watching room ${normalizedCode}`, 'ws');
}

export function handleLeaveSpectate(ws: WebSocket) {
  const spectator = spectatorConnections.get(ws);
  if (!spectator) return;

  const room = rooms.get(spectator.roomCode);
  if (room) {
    room.spectators.delete(spectator.spectatorId);
    broadcastSpectatorCount(room);
  }

  spectatorConnections.delete(ws);
  ws.send(JSON.stringify({ type: 'left' }));
  log(`Spectator ${spectator.displayName} stopped watching room ${spectator.roomCode}`, 'ws');
}

export function handleSpectatorDisconnect(spectator: ConnectedSpectator) {
  const room = rooms.get(spectator.roomCode);
  if (room) {
    room.spectators.delete(spectator.spectatorId);
    broadcastSpectatorCount(room);
  }
  spectatorConnections.delete(spectator.ws);
  log(`Spectator ${spectator.displayName} disconnected from room ${spectator.roomCode}`, 'ws');
}

export function handleListActiveGames(ws: WebSocket) {
  const games: { roomCode: string; playerNames: string[]; phase: string; spectatorCount: number }[] = [];

  const allRooms = Array.from(rooms.entries());
  for (const [code, room] of allRooms) {
    if (room.gameState && room.gameState.phase !== 'setup') {
      games.push({
        roomCode: code,
        playerNames: room.gameState.players.map(p => p.name),
        phase: room.gameState.phase,
        spectatorCount: room.spectators.size,
      });
    }
  }

  ws.send(JSON.stringify({
    type: 'active_games',
    games,
  }));
}

export function broadcastSpectatorCount(room: import('./types').GameRoom) {
  const countMsg = JSON.stringify({ type: 'spectator_count_updated', count: room.spectators.size });

  const players = Array.from(room.players.values());
  for (const player of players) {
    safeSend(player.ws, countMsg);
  }
  const spectators = Array.from(room.spectators.values());
  for (const spectator of spectators) {
    safeSend(spectator.ws, countMsg);
  }
}

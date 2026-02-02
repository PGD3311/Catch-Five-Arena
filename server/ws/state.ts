import { WebSocket } from 'ws';
import type { ConnectedPlayer, ConnectedSpectator, GameRoom } from './types';
import { log } from '../index';

// ── Global Maps ──

export const rooms = new Map<string, GameRoom>();
export const playerConnections = new Map<WebSocket, ConnectedPlayer>();
export const spectatorConnections = new Map<WebSocket, ConnectedSpectator>();
export const turnTimers = new Map<string, NodeJS.Timeout>();
export const turnTimerPlayerIndex = new Map<string, number>();
export const lobbyDisconnectTimers = new Map<string, NodeJS.Timeout>();
export const roomCleanupTimers = new Map<string, NodeJS.Timeout>();

// ── Constants ──

export const TURN_TIMEOUT_MS = 20000;
export const TURN_TIMEOUT_BUFFER_MS = 1500;

// ── Utility Functions ──

export function safeSend(ws: WebSocket | null, data: string): void {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  } catch (err) {
    log(`Failed to send WebSocket message: ${err}`, 'ws');
  }
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getPlayerList(room: GameRoom): { seatIndex: number; playerName: string; connected: boolean; isCpu: boolean }[] {
  const seatMap = new Map<number, { seatIndex: number; playerName: string; connected: boolean; isCpu: boolean }>();

  for (const cpu of room.cpuPlayers) {
    seatMap.set(cpu.seatIndex, {
      seatIndex: cpu.seatIndex,
      playerName: cpu.playerName,
      connected: true,
      isCpu: true,
    });
  }

  const humanPlayers = Array.from(room.players.values());
  humanPlayers.sort((a, b) => {
    const aConnected = a.ws !== null && a.ws.readyState === WebSocket.OPEN;
    const bConnected = b.ws !== null && b.ws.readyState === WebSocket.OPEN;
    return (aConnected ? 1 : 0) - (bConnected ? 1 : 0);
  });

  for (const p of humanPlayers) {
    const isConnected = p.ws !== null && p.ws.readyState === WebSocket.OPEN;
    const existing = seatMap.get(p.seatIndex);
    if (!existing || existing.isCpu || isConnected) {
      seatMap.set(p.seatIndex, {
        seatIndex: p.seatIndex,
        playerName: p.playerName,
        connected: isConnected,
        isCpu: false,
      });
    }
  }

  return Array.from(seatMap.values()).sort((a, b) => a.seatIndex - b.seatIndex);
}

export function broadcastToRoom(room: GameRoom, message: any, excludeWs?: WebSocket, includeSpectators = true) {
  const data = JSON.stringify(message);
  const players = Array.from(room.players.values());
  for (const player of players) {
    if (player.ws && player.ws !== excludeWs) {
      safeSend(player.ws, data);
    }
  }
  if (includeSpectators) {
    const spectators = Array.from(room.spectators.values());
    for (const spectator of spectators) {
      if (spectator.ws !== excludeWs) {
        safeSend(spectator.ws, data);
      }
    }
  }
}

export function getRoomById(roomId: string): GameRoom | undefined {
  return Array.from(rooms.values()).find(r => r.id === roomId);
}

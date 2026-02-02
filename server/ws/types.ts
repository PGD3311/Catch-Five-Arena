import type { WebSocket } from 'ws';
import type { GameState, DeckColor, ChatMessage } from '@shared/gameTypes';

export interface ConnectedPlayer {
  ws: WebSocket;
  roomId: string;
  playerToken: string;
  seatIndex: number;
  playerName: string;
  userId?: string;
}

export interface CpuPlayer {
  seatIndex: number;
  playerName: string;
}

export interface ConnectedSpectator {
  ws: WebSocket;
  roomCode: string;
  spectatorId: string;
  displayName: string;
}

export interface GameRoom {
  id: string;
  code: string;
  players: Map<string, ConnectedPlayer>;
  cpuPlayers: CpuPlayer[];
  spectators: Map<string, ConnectedSpectator>;
  gameState: GameState | null;
  deckColor: DeckColor;
  targetScore: number;
  chatMessages: ChatMessage[];
  lastProcessedRoundSignature?: string;
  lastProcessedGame?: number;
  lastProcessedGameOver?: number;
  gameInstanceId?: number;
}

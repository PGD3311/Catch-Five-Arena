import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { storage } from './storage';
import { log } from './index';
import type { GameState, Card, Suit, DeckColor } from '@shared/gameTypes';
import * as gameEngine from '@shared/gameEngine';

interface ConnectedPlayer {
  ws: WebSocket;
  roomId: string;
  playerToken: string;
  seatIndex: number;
  playerName: string;
}

interface GameRoom {
  id: string;
  code: string;
  players: Map<string, ConnectedPlayer>;
  gameState: GameState | null;
  deckColor: DeckColor;
  targetScore: number;
}

const rooms = new Map<string, GameRoom>();
const playerConnections = new Map<WebSocket, ConnectedPlayer>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function initializeWebSocket(server: any): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    log('WebSocket client connected', 'ws');

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        log(`WebSocket error: ${error}`, 'ws');
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      const player = playerConnections.get(ws);
      if (player) {
        handlePlayerDisconnect(player);
        playerConnections.delete(ws);
      }
      log('WebSocket client disconnected', 'ws');
    });
  });

  return wss;
}

async function handleMessage(ws: WebSocket, message: any) {
  switch (message.type) {
    case 'create_room':
      await handleCreateRoom(ws, message);
      break;
    case 'join_room':
      await handleJoinRoom(ws, message);
      break;
    case 'start_game':
      await handleStartGame(ws);
      break;
    case 'player_action':
      await handlePlayerAction(ws, message);
      break;
    case 'leave_room':
      await handleLeaveRoom(ws);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

async function handleCreateRoom(ws: WebSocket, message: any) {
  const { playerName, deckColor = 'blue', targetScore = 31 } = message;
  
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }

  const roomId = randomUUID();
  const playerToken = randomUUID();

  const room: GameRoom = {
    id: roomId,
    code,
    players: new Map(),
    gameState: null,
    deckColor,
    targetScore,
  };

  const connectedPlayer: ConnectedPlayer = {
    ws,
    roomId,
    playerToken,
    seatIndex: 0,
    playerName: playerName || 'Player 1',
  };

  room.players.set(playerToken, connectedPlayer);
  rooms.set(code, room);
  playerConnections.set(ws, connectedPlayer);

  await storage.createRoom({
    code,
    hostPlayerId: playerToken,
    deckColor,
    targetScore,
    status: 'waiting',
    gameState: null,
  });

  await storage.addPlayerToRoom({
    roomId,
    seatIndex: 0,
    playerToken,
    playerName: playerName || 'Player 1',
    isHuman: true,
    isConnected: true,
  });

  ws.send(JSON.stringify({
    type: 'room_created',
    roomCode: code,
    playerToken,
    seatIndex: 0,
    players: getPlayerList(room),
  }));

  log(`Room ${code} created by ${playerName}`, 'ws');
}

async function handleJoinRoom(ws: WebSocket, message: any) {
  const { roomCode, playerName, playerToken: existingToken } = message;
  
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }

  if (existingToken && room.players.has(existingToken)) {
    const existingPlayer = room.players.get(existingToken)!;
    existingPlayer.ws = ws;
    playerConnections.set(ws, existingPlayer);
    
    ws.send(JSON.stringify({
      type: 'rejoined',
      roomCode: room.code,
      playerToken: existingToken,
      seatIndex: existingPlayer.seatIndex,
      players: getPlayerList(room),
      gameState: room.gameState ? filterGameStateForPlayer(room.gameState, existingPlayer.seatIndex) : null,
    }));
    
    broadcastToRoom(room, { type: 'player_reconnected', seatIndex: existingPlayer.seatIndex }, ws);
    return;
  }

  const takenSeats = Array.from(room.players.values()).map(p => p.seatIndex);
  const availableSeat = [0, 1, 2, 3].find(seat => !takenSeats.includes(seat));
  
  if (availableSeat === undefined) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
    return;
  }

  const playerToken = randomUUID();
  const connectedPlayer: ConnectedPlayer = {
    ws,
    roomId: room.id,
    playerToken,
    seatIndex: availableSeat,
    playerName: playerName || `Player ${availableSeat + 1}`,
  };

  room.players.set(playerToken, connectedPlayer);
  playerConnections.set(ws, connectedPlayer);

  await storage.addPlayerToRoom({
    roomId: room.id,
    seatIndex: availableSeat,
    playerToken,
    playerName: playerName || `Player ${availableSeat + 1}`,
    isHuman: true,
    isConnected: true,
  });

  ws.send(JSON.stringify({
    type: 'joined',
    roomCode: room.code,
    playerToken,
    seatIndex: availableSeat,
    players: getPlayerList(room),
  }));

  broadcastToRoom(room, {
    type: 'player_joined',
    seatIndex: availableSeat,
    playerName: playerName || `Player ${availableSeat + 1}`,
    players: getPlayerList(room),
  }, ws);

  log(`${playerName} joined room ${room.code}`, 'ws');
}

async function handleStartGame(ws: WebSocket) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room) return;

  let state = gameEngine.initializeGame(room.deckColor, room.targetScore);
  
  const connectedPlayers = Array.from(room.players.values());
  state.players = state.players.map((p, index) => {
    const connectedPlayer = connectedPlayers.find(cp => cp.seatIndex === index);
    return {
      ...p,
      name: connectedPlayer?.playerName || `CPU ${index + 1}`,
      isHuman: !!connectedPlayer,
    };
  });

  state = gameEngine.startDealerDraw(state);
  room.gameState = state;

  broadcastGameState(room);
  log(`Game started in room ${room.code}`, 'ws');
}

async function handlePlayerAction(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room || !room.gameState) return;

  if (room.gameState.currentPlayerIndex !== player.seatIndex && 
      room.gameState.phase !== 'dealer-draw' && 
      room.gameState.phase !== 'purge-draw') {
    ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
    return;
  }

  const { action, data } = message;

  let newState = room.gameState;

  switch (action) {
    case 'finalize_dealer_draw':
      newState = gameEngine.finalizeDealerDraw(newState);
      newState = gameEngine.dealCards(newState);
      break;
    case 'bid':
      newState = gameEngine.processBid(newState, data.amount);
      break;
    case 'select_trump':
      newState = gameEngine.selectTrump(newState, data.suit);
      break;
    case 'play_card':
      newState = gameEngine.playCard(newState, data.card);
      break;
  }

  room.gameState = newState;
  broadcastGameState(room);

  await processCpuTurns(room);
}

async function processCpuTurns(room: GameRoom) {
  if (!room.gameState) return;
  
  let state = room.gameState;
  
  while (state.phase !== 'scoring' && state.phase !== 'game-over') {
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.isHuman) break;
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (state.phase === 'bidding') {
      const isDealer = state.dealerIndex === state.currentPlayerIndex;
      const passedCount = state.players.filter(p => p.bid === 0).length;
      const allOthersPassed = passedCount === 3;
      const cpuBid = gameEngine.getCpuBid(currentPlayer.hand, state.highBid, isDealer, allOthersPassed);
      state = gameEngine.processBid(state, cpuBid);
    } else if (state.phase === 'trump-selection') {
      const trumpSuit = gameEngine.getCpuTrumpChoice(currentPlayer.hand);
      state = gameEngine.selectTrump(state, trumpSuit);
    } else if (state.phase === 'playing') {
      const card = gameEngine.getCpuCardToPlay(currentPlayer.hand, state.currentTrick, state.trumpSuit!);
      state = gameEngine.playCard(state, card);
    } else {
      break;
    }
    
    room.gameState = state;
    broadcastGameState(room);
  }
}

async function handleLeaveRoom(ws: WebSocket) {
  const player = playerConnections.get(ws);
  if (!player) return;
  
  handlePlayerDisconnect(player);
  playerConnections.delete(ws);
  ws.send(JSON.stringify({ type: 'left' }));
}

function handlePlayerDisconnect(player: ConnectedPlayer) {
  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room) return;

  room.players.delete(player.playerToken);
  
  broadcastToRoom(room, {
    type: 'player_disconnected',
    seatIndex: player.seatIndex,
    players: getPlayerList(room),
  });

  if (room.players.size === 0) {
    rooms.delete(room.code);
    storage.deleteRoom(room.id);
    log(`Room ${room.code} deleted (empty)`, 'ws');
  }
}

function getPlayerList(room: GameRoom): { seatIndex: number; playerName: string; connected: boolean }[] {
  return Array.from(room.players.values()).map(p => ({
    seatIndex: p.seatIndex,
    playerName: p.playerName,
    connected: true,
  }));
}

function filterGameStateForPlayer(state: GameState, seatIndex: number): GameState {
  return {
    ...state,
    players: state.players.map((p, index) => ({
      ...p,
      hand: index === seatIndex ? p.hand : p.hand.map(() => ({ rank: '2', suit: 'Spades', id: 'hidden' } as Card)),
    })),
  };
}

function broadcastGameState(room: GameRoom) {
  if (!room.gameState) return;
  
  const players = Array.from(room.players.values());
  for (const player of players) {
    const filteredState = filterGameStateForPlayer(room.gameState, player.seatIndex);
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify({
        type: 'game_state',
        gameState: filteredState,
      }));
    }
  }
}

function broadcastToRoom(room: GameRoom, message: any, excludeWs?: WebSocket) {
  const players = Array.from(room.players.values());
  for (const player of players) {
    if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  }
}

export function getRoomByCode(code: string): GameRoom | undefined {
  return rooms.get(code);
}

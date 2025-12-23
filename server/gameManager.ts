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

interface CpuPlayer {
  seatIndex: number;
  playerName: string;
}

interface GameRoom {
  id: string;
  code: string;
  players: Map<string, ConnectedPlayer>;
  cpuPlayers: CpuPlayer[];
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
    
    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        
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

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      if ((ws as any).isAlive === false) {
        const player = playerConnections.get(ws);
        if (player) {
          handlePlayerDisconnect(player);
          playerConnections.delete(ws);
        }
        return ws.terminate();
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
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
    case 'add_cpu':
      await handleAddCpu(ws, message);
      break;
    case 'remove_cpu':
      await handleRemoveCpu(ws, message);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

async function handleCreateRoom(ws: WebSocket, message: any) {
  const { playerName, deckColor = 'blue', targetScore = 25 } = message;
  
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
    cpuPlayers: [],
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
  
  const normalizedCode = roomCode?.toUpperCase?.() || '';
  log(`Join room attempt: code=${normalizedCode}, available rooms: ${Array.from(rooms.keys()).join(', ')}`, 'ws');
  
  let room = rooms.get(normalizedCode);
  
  if (!room) {
    const storedRoom = await storage.getRoomByCode(normalizedCode);
    if (storedRoom) {
      log(`Restoring room ${normalizedCode} from database`, 'ws');
      room = {
        id: storedRoom.id,
        code: storedRoom.code,
        players: new Map(),
        cpuPlayers: [],
        gameState: storedRoom.gameState as GameState | null,
        deckColor: (storedRoom.deckColor || 'blue') as DeckColor,
        targetScore: storedRoom.targetScore || 25,
      };
      rooms.set(normalizedCode, room);
    }
  }
  
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

  const humanSeats = Array.from(room.players.values()).map(p => p.seatIndex);
  const cpuSeats = room.cpuPlayers.map(cpu => cpu.seatIndex);
  
  let availableSeat = [0, 1, 2, 3].find(seat => !humanSeats.includes(seat) && !cpuSeats.includes(seat));
  
  if (availableSeat === undefined) {
    const cpuSeatToReplace = [0, 1, 2, 3].find(seat => !humanSeats.includes(seat) && cpuSeats.includes(seat));
    if (cpuSeatToReplace !== undefined) {
      room.cpuPlayers = room.cpuPlayers.filter(cpu => cpu.seatIndex !== cpuSeatToReplace);
      availableSeat = cpuSeatToReplace;
      log(`CPU removed from seat ${cpuSeatToReplace} to make room for human player`, 'ws');
    }
  }
  
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

  const playerList = getPlayerList(room);
  if (playerList.length !== 4) {
    ws.send(JSON.stringify({ type: 'error', message: 'Need exactly 4 players to start' }));
    return;
  }

  let state = gameEngine.initializeGame(room.deckColor, room.targetScore);
  
  const connectedPlayers = Array.from(room.players.values());
  state.players = state.players.map((p, index) => {
    const connectedPlayer = connectedPlayers.find(cp => cp.seatIndex === index);
    const cpuPlayer = room.cpuPlayers.find(cpu => cpu.seatIndex === index);
    
    if (connectedPlayer) {
      return {
        ...p,
        name: connectedPlayer.playerName,
        isHuman: true,
      };
    } else if (cpuPlayer) {
      return {
        ...p,
        name: cpuPlayer.playerName,
        isHuman: false,
      };
    }
    return {
      ...p,
      name: `CPU ${index + 1}`,
      isHuman: false,
    };
  });

  state = gameEngine.startDealerDraw(state);
  room.gameState = state;

  broadcastGameState(room);
  log(`Game started in room ${room.code}`, 'ws');
}

async function handlePlayerAction(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not connected to a room' }));
    return;
  }

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room || !room.gameState) {
    ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
    return;
  }

  const phase = room.gameState.phase;
  const isAnyPlayerPhase = phase === 'dealer-draw' || phase === 'purge-draw' || phase === 'scoring' || phase === 'game-over';
  const isPlayerAction = message.action === 'sort_hand'; // Actions that don't require turn
  
  if (room.gameState.currentPlayerIndex !== player.seatIndex && !isAnyPlayerPhase && !isPlayerAction) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
    return;
  }

  const { action, data } = message;
  
  if (!action || typeof action !== 'string') {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid action' }));
    return;
  }

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
    case 'continue':
      if (gameEngine.checkGameOver(newState)) {
        newState = gameEngine.initializeGame(room.deckColor, room.targetScore);
      } else {
        newState = gameEngine.startNewRound(newState);
      }
      break;
    case 'purge_draw_complete':
      newState = gameEngine.performPurgeAndDraw(newState);
      break;
    case 'sort_hand': {
      const SUIT_ORDER: Record<string, number> = { 'Clubs': 0, 'Diamonds': 1, 'Hearts': 2, 'Spades': 3 };
      const RANK_ORDER: Record<string, number> = {
        'A': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6,
        '8': 7, '9': 8, '10': 9, 'J': 10, 'Q': 11, 'K': 12
      };
      newState = {
        ...newState,
        players: newState.players.map((p, idx) => {
          if (idx === player.seatIndex) {
            const sortedHand = [...p.hand].sort((a, b) => {
              const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
              if (suitDiff !== 0) return suitDiff;
              return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
            });
            return { ...p, hand: sortedHand };
          }
          return p;
        }),
      };
      break;
    }
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
      // Check if dealer was forced to bid (all others passed, bid is minimum)
      const wasForcedBid = state.highBid === 5 && 
        state.players.filter(p => p.bid === 0).length === 3;
      const trumpSuit = gameEngine.getCpuTrumpChoice(currentPlayer.hand, wasForcedBid);
      state = gameEngine.selectTrump(state, trumpSuit);
    } else if (state.phase === 'playing') {
      const card = gameEngine.getCpuCardToPlay(
        currentPlayer.hand, 
        state.currentTrick, 
        state.trumpSuit!,
        currentPlayer.id,
        state.players,
        state.bidderId
      );
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

async function handleAddCpu(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room) return;

  if (player.seatIndex !== 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only the host can add CPU players' }));
    return;
  }

  const { seatIndex } = message;
  
  if (typeof seatIndex !== 'number' || seatIndex < 0 || seatIndex > 3) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid seat index' }));
    return;
  }
  
  const takenSeats = [
    ...Array.from(room.players.values()).map(p => p.seatIndex),
    ...room.cpuPlayers.map(cpu => cpu.seatIndex),
  ];
  
  if (takenSeats.includes(seatIndex)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Seat is already taken' }));
    return;
  }

  const cpuNames = ['CPU Alpha', 'CPU Beta', 'CPU Gamma', 'CPU Delta'];
  room.cpuPlayers.push({
    seatIndex,
    playerName: cpuNames[seatIndex] || `CPU ${seatIndex + 1}`,
  });

  broadcastToRoom(room, {
    type: 'player_joined',
    seatIndex,
    playerName: cpuNames[seatIndex],
    players: getPlayerList(room),
  });

  log(`CPU added to seat ${seatIndex} in room ${room.code}`, 'ws');
}

async function handleRemoveCpu(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room) return;

  if (player.seatIndex !== 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only the host can remove CPU players' }));
    return;
  }

  const { seatIndex } = message;
  
  if (typeof seatIndex !== 'number' || seatIndex < 0 || seatIndex > 3) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid seat index' }));
    return;
  }
  
  const cpuIndex = room.cpuPlayers.findIndex(cpu => cpu.seatIndex === seatIndex);
  if (cpuIndex === -1) {
    ws.send(JSON.stringify({ type: 'error', message: 'No CPU at this seat' }));
    return;
  }

  room.cpuPlayers.splice(cpuIndex, 1);

  broadcastToRoom(room, {
    type: 'player_disconnected',
    seatIndex,
    players: getPlayerList(room),
  });

  log(`CPU removed from seat ${seatIndex} in room ${room.code}`, 'ws');
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

function getPlayerList(room: GameRoom): { seatIndex: number; playerName: string; connected: boolean; isCpu: boolean }[] {
  const humanPlayers = Array.from(room.players.values()).map(p => ({
    seatIndex: p.seatIndex,
    playerName: p.playerName,
    connected: true,
    isCpu: false,
  }));
  
  const cpuPlayersList = room.cpuPlayers.map(cpu => ({
    seatIndex: cpu.seatIndex,
    playerName: cpu.playerName,
    connected: true,
    isCpu: true,
  }));
  
  return [...humanPlayers, ...cpuPlayersList].sort((a, b) => a.seatIndex - b.seatIndex);
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

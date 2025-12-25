import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { storage } from './storage';
import { log } from './index';
import type { GameState, Card, Suit, DeckColor, ChatMessage } from '@shared/gameTypes';
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
  chatMessages: ChatMessage[];
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
    case 'swap_seats':
      await handleSwapSeats(ws, message);
      break;
    case 'randomize_teams':
      await handleRandomizeTeams(ws);
      break;
    case 'send_chat':
      await handleSendChat(ws, message);
      break;
    case 'preview_room':
      handlePreviewRoom(ws, message);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
}

function handlePreviewRoom(ws: WebSocket, message: any) {
  const { roomCode } = message;
  const room = rooms.get(roomCode?.toUpperCase());
  
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }
  
  if (room.gameState) {
    ws.send(JSON.stringify({ type: 'error', message: 'Game already in progress' }));
    return;
  }
  
  const players = getPlayerList(room);
  const occupiedSeats = new Set(players.map(p => p.seatIndex));
  const availableSeats = [0, 1, 2, 3].filter(seat => !occupiedSeats.has(seat));
  
  ws.send(JSON.stringify({
    type: 'room_preview',
    roomCode: room.code,
    players,
    availableSeats,
  }));
}

async function handleCreateRoom(ws: WebSocket, message: any) {
  const { playerName, deckColor = 'blue', targetScore = 25 } = message;
  
  // Require a player name to create a room
  const trimmedName = playerName?.trim?.() || '';
  if (!trimmedName) {
    ws.send(JSON.stringify({ type: 'error', message: 'Please enter your name to create a room' }));
    return;
  }
  
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
    chatMessages: [],
  };

  const connectedPlayer: ConnectedPlayer = {
    ws,
    roomId,
    playerToken,
    seatIndex: 0,
    playerName: trimmedName,
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
    playerName: trimmedName,
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

  log(`Room ${code} created by ${trimmedName}`, 'ws');
}

async function handleJoinRoom(ws: WebSocket, message: any) {
  const { roomCode, playerName, playerToken: existingToken, preferredSeat } = message;
  
  // Require a player name to join
  const trimmedName = playerName?.trim?.() || '';
  if (!trimmedName && !existingToken) {
    ws.send(JSON.stringify({ type: 'error', message: 'Please enter your name to join' }));
    return;
  }
  
  const normalizedCode = roomCode?.toUpperCase?.() || '';
  log(`Join room attempt: code=${normalizedCode}, available rooms: ${Array.from(rooms.keys()).join(', ')}`, 'ws');
  
  let room = rooms.get(normalizedCode);
  
  if (!room) {
    const storedRoom = await storage.getRoomByCode(normalizedCode);
    if (storedRoom) {
      log(`Restoring room ${normalizedCode} from database`, 'ws');
      
      // Create the room with empty players initially
      room = {
        id: storedRoom.id,
        code: storedRoom.code,
        players: new Map(),
        cpuPlayers: [],
        gameState: storedRoom.gameState as GameState | null,
        deckColor: (storedRoom.deckColor || 'blue') as DeckColor,
        targetScore: storedRoom.targetScore || 25,
        chatMessages: [],
      };
      
      // Restore player seat assignments from database (without WebSocket connections)
      // This allows players to rejoin with their original tokens and seat indices
      const storedPlayers = await storage.getPlayersInRoom(storedRoom.id);
      
      // Use a Set to track occupied seats and prevent duplicates
      const occupiedSeats = new Set<number>();
      
      for (const storedPlayer of storedPlayers) {
        // Skip if this seat is already occupied (prevent duplicates)
        if (occupiedSeats.has(storedPlayer.seatIndex)) {
          log(`Skipping duplicate player at seat ${storedPlayer.seatIndex}`, 'ws');
          continue;
        }
        
        if (storedPlayer.isHuman) {
          // Create placeholder for human players - they'll reconnect with their token
          room.players.set(storedPlayer.playerToken, {
            ws: null as any, // Will be set when player reconnects
            roomId: storedRoom.id,
            playerToken: storedPlayer.playerToken,
            seatIndex: storedPlayer.seatIndex,
            playerName: storedPlayer.playerName,
          });
          occupiedSeats.add(storedPlayer.seatIndex);
        } else {
          // Restore CPU players (only if not already present)
          if (!room.cpuPlayers.some(cpu => cpu.seatIndex === storedPlayer.seatIndex)) {
            room.cpuPlayers.push({
              seatIndex: storedPlayer.seatIndex,
              playerName: storedPlayer.playerName,
            });
            occupiedSeats.add(storedPlayer.seatIndex);
          }
        }
      }
      
      rooms.set(normalizedCode, room);
    }
  }
  
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found', clearSession: true }));
    return;
  }

  if (existingToken && room.players.has(existingToken)) {
    const existingPlayer = room.players.get(existingToken)!;
    existingPlayer.ws = ws;
    playerConnections.set(ws, existingPlayer);
    
    log(`Player ${existingPlayer.playerName} rejoined room ${room.code} at seat ${existingPlayer.seatIndex}`, 'ws');
    
    ws.send(JSON.stringify({
      type: 'rejoined',
      roomCode: room.code,
      playerToken: existingToken,
      seatIndex: existingPlayer.seatIndex,
      players: getPlayerList(room),
      gameState: room.gameState ? filterGameStateForPlayer(room.gameState, existingPlayer.seatIndex) : null,
      chatMessages: room.chatMessages,
    }));
    
    broadcastToRoom(room, { type: 'player_reconnected', seatIndex: existingPlayer.seatIndex }, ws);
    return;
  }
  
  // If player has a stale token that doesn't exist in this room, clear their session and ask them to rejoin fresh
  if (existingToken && !room.players.has(existingToken)) {
    log(`Stale token detected for room ${room.code}, asking player to rejoin fresh`, 'ws');
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Your session expired. Please rejoin the room.',
      clearSession: true 
    }));
    return;
  }
  
  // Get all human player seats (both connected and disconnected during lobby)
  // Don't clean up stale players here - let handlePlayerDisconnect manage that
  const humanSeats = Array.from(room.players.values()).map(p => p.seatIndex);
  const cpuSeats = room.cpuPlayers.map(cpu => cpu.seatIndex);
  
  let availableSeat: number | undefined;
  
  // Check if preferred seat is available
  if (typeof preferredSeat === 'number' && preferredSeat >= 0 && preferredSeat <= 3) {
    if (!humanSeats.includes(preferredSeat) && !cpuSeats.includes(preferredSeat)) {
      availableSeat = preferredSeat;
    } else if (!humanSeats.includes(preferredSeat) && cpuSeats.includes(preferredSeat)) {
      // Replace CPU at preferred seat
      room.cpuPlayers = room.cpuPlayers.filter(cpu => cpu.seatIndex !== preferredSeat);
      availableSeat = preferredSeat;
      log(`CPU removed from seat ${preferredSeat} to give player their preferred seat`, 'ws');
    }
  }
  
  // If preferred seat not available, find any available seat
  if (availableSeat === undefined) {
    availableSeat = [0, 1, 2, 3].find(seat => !humanSeats.includes(seat) && !cpuSeats.includes(seat));
  }
  
  // If still no seat, try replacing a CPU
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
    playerName: trimmedName,
  };

  room.players.set(playerToken, connectedPlayer);
  playerConnections.set(ws, connectedPlayer);

  await storage.addPlayerToRoom({
    roomId: room.id,
    seatIndex: availableSeat,
    playerToken,
    playerName: trimmedName,
    isHuman: true,
    isConnected: true,
  });

  const playerList = getPlayerList(room);
  log(`Player ${trimmedName} joining seat ${availableSeat}, player list: ${JSON.stringify(playerList)}`, 'ws');

  ws.send(JSON.stringify({
    type: 'joined',
    roomCode: room.code,
    playerToken,
    seatIndex: availableSeat,
    players: playerList,
  }));

  broadcastToRoom(room, {
    type: 'player_joined',
    seatIndex: availableSeat,
    playerName: trimmedName,
    players: getPlayerList(room),
  }, ws);

  log(`${trimmedName} joined room ${room.code}`, 'ws');
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
    case 'discard_trump':
      newState = gameEngine.discardTrumpCard(newState, data.card);
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
  
  while (state.phase !== 'scoring' && state.phase !== 'game-over' && state.phase !== 'purge-draw') {
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.isHuman) break;
    
    // Longer delay for CPU actions (1.2-1.5 seconds) for better visual pacing
    const baseDelay = 1200 + Math.random() * 300;
    await new Promise(resolve => setTimeout(resolve, baseDelay));
    
    // Check again after delay (state may have changed)
    if (!room.gameState) return;
    state = room.gameState;
    if (state.players[state.currentPlayerIndex].isHuman) break;
    
    const trickLengthBefore = state.currentTrick.length;
    
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
    } else if (state.phase === 'discard-trump') {
      const cardToDiscard = gameEngine.getCpuTrumpToDiscard(currentPlayer.hand, state.trumpSuit!);
      state = gameEngine.discardTrumpCard(state, cardToDiscard);
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
    
    // If a trick just completed (was 3 cards, now reset to 0), add extra delay for animation
    if (trickLengthBefore === 3 && state.currentTrick.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      // Re-check state after the pause
      if (!room.gameState) return;
      state = room.gameState;
    }
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
  
  // Check if any player (human or CPU) is at this seat
  const humanAtSeat = Array.from(room.players.values()).find(p => p.seatIndex === seatIndex);
  const cpuAtSeat = room.cpuPlayers.find(cpu => cpu.seatIndex === seatIndex);
  
  if (humanAtSeat || cpuAtSeat) {
    ws.send(JSON.stringify({ type: 'error', message: 'Seat is already taken' }));
    return;
  }

  const cpuNames = ['CPU Alpha', 'CPU Beta', 'CPU Gamma', 'CPU Delta'];
  room.cpuPlayers.push({
    seatIndex,
    playerName: cpuNames[seatIndex] || `CPU ${seatIndex + 1}`,
  });
  
  // Update database
  await storage.addPlayerToRoom({
    roomId: room.id,
    seatIndex,
    playerToken: `cpu-${seatIndex}-${room.id}`,
    playerName: cpuNames[seatIndex] || `CPU ${seatIndex + 1}`,
    isHuman: false,
    isConnected: true,
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

async function handleSwapSeats(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room) return;

  if (player.seatIndex !== 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only the host can swap seats' }));
    return;
  }

  if (room.gameState) {
    ws.send(JSON.stringify({ type: 'error', message: 'Cannot swap seats during game' }));
    return;
  }

  const { seat1, seat2 } = message;
  
  if (typeof seat1 !== 'number' || typeof seat2 !== 'number' || 
      seat1 < 0 || seat1 > 3 || seat2 < 0 || seat2 > 3 || seat1 === seat2) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid seat indices' }));
    return;
  }

  const player1Human = Array.from(room.players.values()).find(p => p.seatIndex === seat1);
  const player2Human = Array.from(room.players.values()).find(p => p.seatIndex === seat2);
  const cpu1Index = room.cpuPlayers.findIndex(cpu => cpu.seatIndex === seat1);
  const cpu2Index = room.cpuPlayers.findIndex(cpu => cpu.seatIndex === seat2);

  if (player1Human) {
    player1Human.seatIndex = seat2;
  } else if (cpu1Index !== -1) {
    room.cpuPlayers[cpu1Index].seatIndex = seat2;
  }

  if (player2Human) {
    player2Human.seatIndex = seat1;
  } else if (cpu2Index !== -1) {
    room.cpuPlayers[cpu2Index].seatIndex = seat1;
  }

  const playerList = getPlayerList(room);
  Array.from(room.players.values()).forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({
        type: 'seats_updated',
        seatIndex: p.seatIndex,
        players: playerList,
      }));
    }
  });

  log(`Seats ${seat1} and ${seat2} swapped in room ${room.code}`, 'ws');
}

async function handleRandomizeTeams(ws: WebSocket) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room) return;

  if (player.seatIndex !== 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only the host can randomize teams' }));
    return;
  }

  if (room.gameState) {
    ws.send(JSON.stringify({ type: 'error', message: 'Cannot randomize during game' }));
    return;
  }

  const allPlayers: { type: 'human' | 'cpu'; token?: string; cpuIndex?: number; name: string }[] = [];
  
  Array.from(room.players.entries()).forEach(([token, p]) => {
    allPlayers.push({ type: 'human', token, name: p.playerName });
  });
  
  room.cpuPlayers.forEach((cpu, index) => {
    allPlayers.push({ type: 'cpu', cpuIndex: index, name: cpu.playerName });
  });

  for (let i = allPlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
  }

  allPlayers.forEach((p, newSeat) => {
    if (p.type === 'human' && p.token) {
      const humanPlayer = room.players.get(p.token);
      if (humanPlayer) {
        humanPlayer.seatIndex = newSeat;
      }
    } else if (p.type === 'cpu' && p.cpuIndex !== undefined) {
      room.cpuPlayers[p.cpuIndex].seatIndex = newSeat;
    }
  });

  const playerList = getPlayerList(room);
  Array.from(room.players.values()).forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({
        type: 'seats_updated',
        seatIndex: p.seatIndex,
        players: playerList,
      }));
    }
  });

  log(`Teams randomized in room ${room.code}`, 'ws');
}

function handlePlayerDisconnect(player: ConnectedPlayer) {
  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room) return;

  // During an active game, don't delete the player - just mark them as disconnected
  // This preserves their seat assignment so they can reconnect with the same token
  if (room.gameState) {
    player.ws = null as any; // Mark as disconnected but keep seat
    log(`Player ${player.playerName} disconnected from active game in room ${room.code}`, 'ws');
  } else {
    // No active game, safe to delete the player
    room.players.delete(player.playerToken);
    log(`Player ${player.playerName} left room ${room.code}`, 'ws');
  }
  
  broadcastToRoom(room, {
    type: 'player_disconnected',
    seatIndex: player.seatIndex,
    players: getPlayerList(room),
  });

  // Only delete room if ALL players are fully disconnected (no players left at all)
  const connectedPlayers = Array.from(room.players.values()).filter(p => p.ws !== null);
  if (connectedPlayers.length === 0 && !room.gameState) {
    rooms.delete(room.code);
    storage.deleteRoom(room.id);
    log(`Room ${room.code} deleted (empty)`, 'ws');
  }
}

function getPlayerList(room: GameRoom): { seatIndex: number; playerName: string; connected: boolean; isCpu: boolean }[] {
  // Build player list, ensuring no duplicate seats
  const seatMap = new Map<number, { seatIndex: number; playerName: string; connected: boolean; isCpu: boolean }>();
  
  // First add CPU players
  for (const cpu of room.cpuPlayers) {
    seatMap.set(cpu.seatIndex, {
      seatIndex: cpu.seatIndex,
      playerName: cpu.playerName,
      connected: true,
      isCpu: true,
    });
  }
  
  // Then add human players (connected ones take priority over disconnected)
  const humanPlayers = Array.from(room.players.values());
  
  // Sort so that connected players come last (and thus overwrite disconnected ones)
  humanPlayers.sort((a, b) => {
    const aConnected = a.ws !== null && a.ws.readyState === WebSocket.OPEN;
    const bConnected = b.ws !== null && b.ws.readyState === WebSocket.OPEN;
    return (aConnected ? 1 : 0) - (bConnected ? 1 : 0);
  });
  
  for (const p of humanPlayers) {
    const isConnected = p.ws !== null && p.ws.readyState === WebSocket.OPEN;
    const existing = seatMap.get(p.seatIndex);
    
    // If there's a CPU at this seat, human takes priority
    // If there's a disconnected human and this is connected, connected wins
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

function filterGameStateForPlayer(state: GameState, seatIndex: number): GameState {
  return {
    ...state,
    players: state.players.map((p, index) => {
      const trumpCount = state.trumpSuit ? p.hand.filter(c => c.suit === state.trumpSuit).length : 0;
      return {
        ...p,
        hand: index === seatIndex ? p.hand : p.hand.map(() => ({ rank: '2', suit: 'Spades', id: 'hidden' } as Card)),
        trumpCount,
      };
    }),
  };
}

function broadcastGameState(room: GameRoom) {
  if (!room.gameState) return;
  
  const players = Array.from(room.players.values());
  for (const player of players) {
    const filteredState = filterGameStateForPlayer(room.gameState, player.seatIndex);
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
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
    if (player.ws && player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  }
}

async function handleSendChat(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' }));
    return;
  }

  const room = rooms.get(player.roomId) || Array.from(rooms.values()).find(r => r.players.has(player.playerToken));
  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }

  const { chatType, content } = message;
  
  if (!content || typeof content !== 'string') {
    return;
  }

  // Validate and sanitize content
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return; // Reject empty or whitespace-only messages
  }
  
  const sanitizedContent = trimmedContent.slice(0, 200);

  const chatMessage: ChatMessage = {
    id: randomUUID(),
    senderId: `player${player.seatIndex + 1}`,
    senderName: player.playerName,
    type: chatType === 'emoji' ? 'emoji' : 'text',
    content: sanitizedContent,
    timestamp: Date.now(),
  };

  // Keep only last 50 messages
  room.chatMessages.push(chatMessage);
  if (room.chatMessages.length > 50) {
    room.chatMessages = room.chatMessages.slice(-50);
  }

  // Broadcast to all players including sender
  const players = Array.from(room.players.values());
  for (const p of players) {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify({
        type: 'chat_message',
        message: chatMessage,
      }));
    }
  }
}

export function getRoomByCode(code: string): GameRoom | undefined {
  return rooms.get(code);
}

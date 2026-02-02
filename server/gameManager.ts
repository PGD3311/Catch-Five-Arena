import { WebSocket, WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { storage } from './storage';
import { log } from './index';
import type { GameState, Card, Suit, DeckColor, ChatMessage } from '@shared/gameTypes';
import { MIN_BID, MAX_BID } from '@shared/gameTypes';
import * as gameEngine from '@shared/gameEngine';

// Track stats for human players when rounds/games complete
async function trackPlayerStats(room: GameRoom, previousPhase: string) {
  if (!room.gameState) return;
  
  const state = room.gameState;
  const newPhase = state.phase;
  const gameInstance = room.gameInstanceId || 0;
  
  // Create a unique round signature using team scores (changes each round)
  const roundSignature = state.teams.map(t => t.score).join('-');
  
  // Use separate dedup for scoring vs game-over (both can occur in same round)
  const isScoring = newPhase === 'scoring';
  const isGameOver = newPhase === 'game-over';
  
  // Check for duplicate round processing (for scoring phase)
  const isScoringAlreadyProcessed = isScoring && 
    room.lastProcessedRoundSignature === roundSignature &&
    room.lastProcessedGame === gameInstance;
  
  // Check for duplicate game-over processing (separate from round processing)
  const isGameOverAlreadyProcessed = isGameOver && 
    room.lastProcessedGameOver === gameInstance;
  
  // Prevent duplicate stats updates
  if (isScoringAlreadyProcessed) {
    log(`Skipping duplicate scoring stats update for round signature ${roundSignature}, game ${gameInstance}`, 'stats');
    return;
  }
  if (isGameOverAlreadyProcessed) {
    log(`Skipping duplicate game-over stats update for game ${gameInstance}`, 'stats');
    return;
  }
  
  // Only track stats when transitioning to scoring or game-over
  if ((previousPhase !== 'scoring' && previousPhase !== 'game-over') &&
      (newPhase === 'scoring' || newPhase === 'game-over')) {
    
    // Mark this round/game as processed based on phase type
    if (isScoring) {
      room.lastProcessedRoundSignature = roundSignature;
      room.lastProcessedGame = gameInstance;
    }
    if (isGameOver) {
      room.lastProcessedGameOver = gameInstance;
    }
    
    // Find the bidder
    const bidder = state.players.find(p => p.id === state.bidderId);
    const bidderTeam = state.teams.find(t => bidder && state.players.find(pl => pl.id === bidder.id)?.teamId === t.id);
    
    // Calculate round scores
    const bidderTeamScore = bidderTeam ? state.roundScores[bidderTeam.id] || 0 : 0;
    const bidMade = bidderTeamScore >= state.highBid;
    
    // Track stats for each human player in the room
    for (const player of Array.from(room.players.values())) {
      try {
        // Get their player data from game state
        const gamePlayer = state.players[player.seatIndex];
        if (!gamePlayer || !gamePlayer.isHuman) continue;
        
        // Get team score for this round
        const playerTeam = state.teams.find(t => t.id === gamePlayer.teamId);
        const teamRoundScore = playerTeam ? state.roundScores[playerTeam.id] || 0 : 0;
        
        // Was this player the bidder?
        const isBidder = gamePlayer.id === state.bidderId;
        
        // Prepare stats increments
        const increments: Record<string, number> = {
          totalPointsScored: teamRoundScore,
        };
        
        if (isBidder) {
          increments.bidsMade = 1;
          if (bidMade) {
            increments.bidsSucceeded = 1;
            if (state.highBid > 0) {
              increments.highestBidMade = state.highBid;
            }
          } else {
            increments.timesSet = 1;
          }
          if (state.highBid > 0) {
            increments.highestBid = state.highBid;
          }
        }
        
        // Track game win/loss on game over — only count when all 4 players are human
        const allHuman = state.players.every(p => p.isHuman);
        if (newPhase === 'game-over' && playerTeam && allHuman) {
          increments.gamesPlayed = 1;
          if (playerTeam.score >= state.targetScore) {
            increments.gamesWon = 1;
          }
        }
        
        // Only update if we have meaningful increments
        if (Object.keys(increments).length > 0) {
          // Use authenticated userId if available, otherwise fall back to playerToken
          const statsUserId = player.userId || player.playerToken;
          await storage.incrementUserStats(statsUserId, increments);
          log(`Updated stats for player ${player.playerName} (userId: ${statsUserId})`, 'stats');
        }
      } catch (err) {
        log(`Error updating stats for ${player.playerName}: ${err}`, 'stats');
      }
    }
  }
}

interface ConnectedPlayer {
  ws: WebSocket;
  roomId: string;
  playerToken: string;
  seatIndex: number;
  playerName: string;
  userId?: string; // Authenticated user ID for cross-device stats
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
  lastProcessedRoundSignature?: string; // Prevent duplicate round stats updates
  lastProcessedGame?: number; // Prevent duplicate game stats updates
  lastProcessedGameOver?: number; // Prevent duplicate game-over stats updates
  gameInstanceId?: number; // Track unique game instances
}

const rooms = new Map<string, GameRoom>();
const playerConnections = new Map<WebSocket, ConnectedPlayer>();
const turnTimers = new Map<string, NodeJS.Timeout>();
const turnTimerPlayerIndex = new Map<string, number>(); // Track which player the timer is for

const lobbyDisconnectTimers = new Map<string, NodeJS.Timeout>(); // token -> timer
const TURN_TIMEOUT_MS = 20000; // 20 seconds per turn (client display)
const TURN_TIMEOUT_BUFFER_MS = 1500; // Extra buffer so server auto-play fires after client timer hits 0

function safeSend(ws: WebSocket | null, data: string): void {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  } catch (err) {
    log(`Failed to send WebSocket message: ${err}`, 'ws');
  }
}

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
          // Mark connection as alive when we receive application-level ping
          (ws as any).isAlive = true;
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        
        await handleMessage(ws, message);
      } catch (error) {
        log(`WebSocket error: ${error}`, 'ws');
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('error', (err) => {
      log(`WebSocket error on connection: ${err.message}`, 'ws');
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

  // Heartbeat every 45 seconds, with 2-miss tolerance for mobile connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
      const missCount = (ws as any).missCount || 0;
      if ((ws as any).isAlive === false) {
        (ws as any).missCount = missCount + 1;
        // Allow 2 missed heartbeats before terminating (90 seconds tolerance)
        if (missCount >= 2) {
          const player = playerConnections.get(ws);
          if (player) {
            handlePlayerDisconnect(player);
            playerConnections.delete(ws);
          }
          return ws.terminate();
        }
      } else {
        (ws as any).missCount = 0;
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 45000);

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
    case 'kick_player':
      await handleKickPlayer(ws, message);
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
  
  // Only block if game is actively in progress (not setup/game-over phases)
  if (room.gameState && room.gameState.phase !== 'setup' && room.gameState.phase !== 'game-over') {
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
  const { playerName, deckColor = 'blue', targetScore = 25, userId } = message;
  
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
    userId: userId || undefined,
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
  const { roomCode, playerName, playerToken: existingToken, preferredSeat, userId } = message;
  
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

    // Cancel lobby disconnect grace period if active
    const lobbyTimer = lobbyDisconnectTimers.get(existingToken);
    if (lobbyTimer) {
      clearTimeout(lobbyTimer);
      lobbyDisconnectTimers.delete(existingToken);
    }

    log(`Player ${existingPlayer.playerName} rejoined room ${room.code} at seat ${existingPlayer.seatIndex}`, 'ws');
    
    // If game is in progress, use broadcastGameState to ensure timers are properly managed
    if (room.gameState) {
      broadcastGameState(room);
    }
    
    ws.send(JSON.stringify({
      type: 'rejoined',
      roomCode: room.code,
      playerToken: existingToken,
      seatIndex: existingPlayer.seatIndex,
      players: getPlayerList(room),
      gameState: room.gameState ? filterGameStateForPlayer(room.gameState, existingPlayer.seatIndex) : null,
      chatMessages: room.chatMessages,
    }));
    
    broadcastToRoom(room, { type: 'player_reconnected', seatIndex: existingPlayer.seatIndex, players: getPlayerList(room) }, ws);
    return;
  }
  
  // If player has a stale token that doesn't exist in this room, clear their session and auto-rejoin
  if (existingToken && !room.players.has(existingToken)) {
    log(`Stale token detected for room ${room.code}, asking player to rejoin fresh`, 'ws');
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Your session expired. Rejoining...',
      clearSession: true,
      roomCode: room.code,
      autoRejoin: true,
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
    userId: userId || undefined,
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
  
  // Increment game instance ID for dedup tracking
  room.gameInstanceId = (room.gameInstanceId || 0) + 1;
  room.lastProcessedRoundSignature = undefined;
  room.lastProcessedGame = room.gameInstanceId;
  
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
  
  // Validate no duplicate cards at game start
  gameEngine.validateNoDuplicates(state, 'after game start/dealer draw');

  broadcastGameState(room);
  log(`Game started in room ${room.code}`, 'ws');
}

async function handlePlayerAction(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) {
    log(`[Action] Error: Player not in a room`, 'game');
    ws.send(JSON.stringify({ type: 'error', message: 'Not connected to a room' }));
    return;
  }

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room || !room.gameState) {
    log(`[Action] Error: Game not found for room ${player.roomId}`, 'game');
    ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
    return;
  }
  
  log(`[Action] Room ${room.code} | Seat ${player.seatIndex} | Action: ${message.action} | Phase: ${room.gameState.phase}`, 'game');

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

  // Clear turn timer when player takes an action (prevents timeout after action)
  if (action === 'bid' || action === 'play_card') {
    clearTurnTimer(room.id);
  }

  let newState = room.gameState;
  
  // Clear turn start time when action is taken
  if (action === 'bid' || action === 'play_card') {
    newState = { ...newState, turnStartTime: undefined };
  }

  switch (action) {
    case 'finalize_dealer_draw':
      // Only process if we're in dealer-draw phase (prevent duplicate calls)
      if (newState.phase === 'dealer-draw') {
        newState = gameEngine.finalizeDealerDraw(newState);
        newState = gameEngine.dealCards(newState);
      }
      break;
    case 'bid': {
      const bidAmount = data?.amount;
      if (typeof bidAmount !== 'number' || (bidAmount !== 0 && (bidAmount < MIN_BID || bidAmount > MAX_BID || !Number.isInteger(bidAmount)))) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid bid amount' }));
        return;
      }
      newState = gameEngine.processBid(newState, bidAmount);
      break;
    }
    case 'select_trump': {
      const VALID_SUITS: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
      if (!VALID_SUITS.includes(data?.suit)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid trump suit' }));
        return;
      }
      newState = gameEngine.selectTrump(newState, data.suit);
      break;
    }
    case 'play_card': {
      const cardToPlay = data?.card;
      const currentHand = newState.players[player.seatIndex]?.hand;
      if (!cardToPlay?.id || !currentHand?.some((c: Card) => c.id === cardToPlay.id)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Card not in your hand' }));
        return;
      }
      // Use the server's copy of the card, not the client's
      const serverCard = currentHand.find((c: Card) => c.id === cardToPlay.id)!;
      newState = gameEngine.playCard(newState, serverCard);
      break;
    }
    case 'discard_trump': {
      const discardCard = data?.card;
      const discardHand = newState.players[player.seatIndex]?.hand;
      if (!discardCard?.id || !discardHand?.some((c: Card) => c.id === discardCard.id)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Card not in your hand' }));
        return;
      }
      const serverDiscardCard = discardHand.find((c: Card) => c.id === discardCard.id)!;
      newState = gameEngine.discardTrumpCard(newState, serverDiscardCard);
      break;
    }
    case 'continue':
      // Only process if we're in scoring or game-over phase (prevent duplicate calls)
      log(`[Continue] Room ${room.code} | Current phase: ${newState.phase} | GameOver: ${gameEngine.checkGameOver(newState)}`, 'game');
      if (newState.phase === 'scoring' || newState.phase === 'game-over') {
        if (gameEngine.checkGameOver(newState)) {
          log(`[Continue] Room ${room.code} | Starting new game`, 'game');
          newState = gameEngine.initializeGame(room.deckColor, room.targetScore);
          // Re-apply player names and types from room (initializeGame uses defaults)
          const connectedPlayers = Array.from(room.players.values());
          newState.players = newState.players.map((p, index) => {
            const cp = connectedPlayers.find(c => c.seatIndex === index);
            const cpu = room.cpuPlayers.find(c => c.seatIndex === index);
            if (cp) return { ...p, name: cp.playerName, isHuman: true };
            if (cpu) return { ...p, name: cpu.playerName, isHuman: false };
            return { ...p, name: `CPU ${index + 1}`, isHuman: false };
          });
          // Increment game instance ID for dedup tracking
          room.gameInstanceId = (room.gameInstanceId || 0) + 1;
          room.lastProcessedRoundSignature = undefined;
          room.lastProcessedGame = room.gameInstanceId;
        } else {
          log(`[Continue] Room ${room.code} | Starting new round`, 'game');
          newState = gameEngine.startNewRound(newState);
        }
        log(`[Continue] Room ${room.code} | New phase: ${newState.phase}`, 'game');
      } else {
        log(`[Continue] Room ${room.code} | Ignored - not in scoring/game-over phase`, 'game');
      }
      break;
    case 'purge_draw_complete':
      // Only process if we're actually in purge-draw phase (prevent duplicate calls)
      if (newState.phase === 'purge-draw') {
        newState = gameEngine.performPurgeAndDraw(newState);
        log(`sleptCards after purge: ${newState.sleptCards?.length || 0} cards`, 'ws');
      } else {
        log(`Ignoring duplicate purge_draw_complete, phase is ${newState.phase}`, 'ws');
      }
      break;
    case 'sort_hand': {
      const trumpSuit = newState.trumpSuit;
      const SUIT_BASE: Record<string, number> = { 'Spades': 0, 'Hearts': 1, 'Clubs': 2, 'Diamonds': 3 };
      const RANK_ORDER: Record<string, number> = {
        'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8,
        '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
      };
      newState = {
        ...newState,
        players: newState.players.map((p, idx) => {
          if (idx === player.seatIndex) {
            const sortedHand = [...p.hand].sort((a, b) => {
              const aIsTrump = trumpSuit && a.suit === trumpSuit ? 0 : 1;
              const bIsTrump = trumpSuit && b.suit === trumpSuit ? 0 : 1;
              if (aIsTrump !== bIsTrump) return aIsTrump - bIsTrump;
              const suitDiff = SUIT_BASE[a.suit] - SUIT_BASE[b.suit];
              if (suitDiff !== 0) return suitDiff;
              return RANK_ORDER[b.rank] - RANK_ORDER[a.rank];
            });
            return { ...p, hand: sortedHand };
          }
          return p;
        }),
      };
      break;
    }
  }

  const previousPhase = room.gameState?.phase || 'setup';
  room.gameState = newState;

  // Persist game state to DB on phase transitions (not every action, to avoid DB spam)
  if (previousPhase !== newState.phase) {
    storage.updateRoom(room.id, { gameState: newState }).catch(err =>
      log(`Failed to persist game state: ${err}`, 'ws')
    );
  }

  // Validate no duplicate cards after every action
  gameEngine.validateNoDuplicates(newState, `after action: ${action}`);
  
  // Track stats when phase changes to scoring or game-over from human action
  const newPhaseStr = newState.phase as string;
  if ((previousPhase !== 'scoring' && previousPhase !== 'game-over') &&
      (newPhaseStr === 'scoring' || newPhaseStr === 'game-over')) {
    await trackPlayerStats(room, previousPhase);
  }
  
  broadcastGameState(room);

  await processCpuTurns(room);
}

async function processCpuTurns(room: GameRoom) {
  if (!room.gameState) return;
  
  let state = room.gameState;
  let previousPhase = state.phase;
  
  while (state.phase !== 'scoring' && state.phase !== 'game-over' && state.phase !== 'purge-draw') {
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.isHuman) break;
    previousPhase = state.phase;
    
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
    
    // Validate no duplicate cards after every CPU action
    gameEngine.validateNoDuplicates(state, `after CPU action in phase: ${state.phase}`);
    
    // Track stats when phase changes to scoring or game-over
    const newPhase = state.phase as string;
    const prevPhaseStr = previousPhase as string;
    if ((prevPhaseStr !== 'scoring' && prevPhaseStr !== 'game-over') &&
        (newPhase === 'scoring' || newPhase === 'game-over')) {
      await trackPlayerStats(room, prevPhaseStr);
    }
    
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

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);

  if (room) {
    if (room.gameState) {
      // Game in progress: keep seat reserved so player can rejoin
      // Just null the WebSocket — the turn timer will auto-play their turns while they're gone
      player.ws = null as any;
      broadcastToRoom(room, {
        type: 'player_disconnected',
        seatIndex: player.seatIndex,
        players: getPlayerList(room),
      });
      log(`Player ${player.playerName} left active game in room ${room.code}, seat reserved for rejoin`, 'ws');
    } else {
      // Lobby: fully remove the player, freeing the seat
      room.players.delete(player.playerToken);
      broadcastToRoom(room, {
        type: 'player_disconnected',
        seatIndex: player.seatIndex,
        players: getPlayerList(room),
      });
      log(`Player ${player.playerName} left lobby in room ${room.code}, seat freed`, 'ws');
    }
  }

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

async function handleKickPlayer(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room) return;

  // Only host (seat 0) can kick players
  if (player.seatIndex !== 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only the host can remove players' }));
    return;
  }

  // Can't kick during a game
  if (room.gameState) {
    ws.send(JSON.stringify({ type: 'error', message: 'Cannot remove players during game' }));
    return;
  }

  const { seatIndex } = message;
  
  if (typeof seatIndex !== 'number' || seatIndex < 0 || seatIndex > 3) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid seat index' }));
    return;
  }

  // Can't kick yourself
  if (seatIndex === 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Cannot remove yourself' }));
    return;
  }

  // Find the player at this seat
  const targetPlayer = Array.from(room.players.entries()).find(([_, p]) => p.seatIndex === seatIndex);
  
  if (!targetPlayer) {
    // Maybe it's a CPU?
    const cpuIndex = room.cpuPlayers.findIndex(cpu => cpu.seatIndex === seatIndex);
    if (cpuIndex !== -1) {
      room.cpuPlayers.splice(cpuIndex, 1);
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'No player at this seat' }));
      return;
    }
  } else {
    const [token, kickedPlayer] = targetPlayer;
    
    // Notify the kicked player
    safeSend(kickedPlayer.ws, JSON.stringify({
      type: 'kicked',
      message: 'You have been removed from the room by the host',
      clearSession: true
    }));
    
    // Remove from playerConnections map
    if (kickedPlayer.ws) {
      playerConnections.delete(kickedPlayer.ws);
    }
    
    // Remove from room
    room.players.delete(token);
    
    log(`Player ${kickedPlayer.playerName} kicked from room ${room.code}`, 'ws');
  }

  // Broadcast updated player list
  broadcastToRoom(room, {
    type: 'player_disconnected',
    seatIndex,
    players: getPlayerList(room),
  });

  log(`Player removed from seat ${seatIndex} in room ${room.code}`, 'ws');
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
    safeSend(p.ws, JSON.stringify({
      type: 'seats_updated',
      seatIndex: p.seatIndex,
      players: playerList,
    }));
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
    safeSend(p.ws, JSON.stringify({
      type: 'seats_updated',
      seatIndex: p.seatIndex,
      players: playerList,
    }));
  });

  log(`Teams randomized in room ${room.code}`, 'ws');
}

// Track room cleanup timers
const roomCleanupTimers = new Map<string, NodeJS.Timeout>();

function handlePlayerDisconnect(player: ConnectedPlayer) {
  const room = Array.from(rooms.values()).find(r => r.id === player.roomId);
  if (!room) return;

  // Always mark player as disconnected but keep their seat assignment and token
  // This allows them to rejoin with the same token whether in lobby or game
  player.ws = null as any; // Mark as disconnected but keep seat

  if (room.gameState) {
    log(`Player ${player.playerName} disconnected from active game in room ${room.code}`, 'ws');
  } else {
    log(`Player ${player.playerName} disconnected from lobby in room ${room.code}`, 'ws');

    // In lobby: start a 30-second grace period — if they don't reconnect, free their seat
    const token = player.playerToken;
    const existingLobbyTimer = lobbyDisconnectTimers.get(token);
    if (existingLobbyTimer) {
      clearTimeout(existingLobbyTimer);
    }
    const lobbyTimer = setTimeout(() => {
      lobbyDisconnectTimers.delete(token);
      // Check if player is still disconnected and room still has no game
      if (player.ws === null && room.players.has(token) && !room.gameState) {
        room.players.delete(token);
        broadcastToRoom(room, {
          type: 'player_disconnected',
          seatIndex: player.seatIndex,
          players: getPlayerList(room),
        });
        log(`Lobby grace period expired for ${player.playerName} in room ${room.code}, seat freed`, 'ws');
      }
    }, 30_000);
    lobbyDisconnectTimers.set(token, lobbyTimer);
  }

  broadcastToRoom(room, {
    type: 'player_disconnected',
    seatIndex: player.seatIndex,
    players: getPlayerList(room),
  });

  // Check if ALL human players are disconnected
  const connectedPlayers = Array.from(room.players.values()).filter(p => p.ws !== null);
  
  if (connectedPlayers.length === 0) {
    log(`All players disconnected from room ${room.code}, starting cleanup timer (1 hour)`, 'ws');
    
    // Cancel any existing cleanup timer
    const existingTimer = roomCleanupTimers.get(room.code);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set a 1-hour cleanup timer - room stays available for reconnection during this time
    const cleanupTimer = setTimeout(() => {
      // Check again if room is still empty
      const currentRoom = rooms.get(room.code);
      if (currentRoom) {
        const stillConnected = Array.from(currentRoom.players.values()).filter(p => p.ws !== null);
        if (stillConnected.length === 0) {
          log(`Cleaning up room ${room.code} after 1 hour of inactivity`, 'ws');
          
          // Reset room state but keep it in memory for a bit longer
          if (currentRoom.gameState) {
            currentRoom.gameState = null;
            currentRoom.chatMessages = [];
          }
          currentRoom.cpuPlayers = [];
          currentRoom.players.clear();
          
          // Update database
          storage.updateRoom(currentRoom.id, { 
            gameState: null, 
            status: 'waiting' 
          }).catch(err => log(`Failed to reset room in DB: ${err}`, 'ws'));
          
          // Remove from memory
          rooms.delete(room.code);
          roomCleanupTimers.delete(room.code);
          log(`Room ${room.code} removed from memory after cleanup`, 'ws');
        }
      }
      roomCleanupTimers.delete(room.code);
    }, 60 * 60 * 1000); // 1 hour
    
    roomCleanupTimers.set(room.code, cleanupTimer);
  } else {
    // Someone is still connected, cancel any cleanup timer
    const existingTimer = roomCleanupTimers.get(room.code);
    if (existingTimer) {
      clearTimeout(existingTimer);
      roomCleanupTimers.delete(room.code);
      log(`Cleanup timer cancelled for room ${room.code} - player still connected`, 'ws');
    }
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

function clearTurnTimer(roomId: string) {
  const existingTimer = turnTimers.get(roomId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    turnTimers.delete(roomId);
  }
  turnTimerPlayerIndex.delete(roomId);
}

function startTurnTimer(room: GameRoom, preserveExistingTime = false) {
  if (!room.gameState) return;
  
  // Clear any existing timer handle (but may preserve the start time)
  const existingTimer = turnTimers.get(room.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
    turnTimers.delete(room.id);
  }
  
  const state = room.gameState;
  const currentPlayer = state.players[state.currentPlayerIndex];
  
  // Only set timer for human players during bidding or playing phases
  if (!currentPlayer.isHuman) return;
  if (state.phase !== 'bidding' && state.phase !== 'playing') return;
  
  // Calculate remaining time and turn start time
  let turnStartTime: number;
  let remainingMs: number;
  
  if (preserveExistingTime && room.gameState.turnStartTime) {
    // Preserve existing timer - calculate remaining time
    turnStartTime = room.gameState.turnStartTime;
    const elapsed = Date.now() - turnStartTime;
    remainingMs = Math.max(0, TURN_TIMEOUT_MS - elapsed);
    
    // If already expired, trigger timeout immediately
    if (remainingMs <= 0) {
      handleTurnTimeout(room, state.currentPlayerIndex);
      return;
    }
  } else {
    // Start fresh timer
    turnStartTime = Date.now();
    remainingMs = TURN_TIMEOUT_MS;
    
    room.gameState = {
      ...room.gameState,
      turnStartTime,
    };
  }
  
  // Track which player this timer is for
  const expectedPlayerIndex = state.currentPlayerIndex;
  turnTimerPlayerIndex.set(room.id, expectedPlayerIndex);

  // Create timeout that will auto-move when time expires
  // Add buffer so server fires AFTER client timer shows 0, preventing race conditions
  // where a last-second player action arrives in the same event loop tick as the timeout
  const timer = setTimeout(() => {
    handleTurnTimeout(room, expectedPlayerIndex);
  }, remainingMs + TURN_TIMEOUT_BUFFER_MS);

  turnTimers.set(room.id, timer);
}

async function handleTurnTimeout(room: GameRoom, expectedPlayerIndex: number) {
  // Clear and delete the timer entry first
  clearTurnTimer(room.id);

  if (!room.gameState) return;

  const state = room.gameState;

  // Verify the turn hasn't already moved (player acted just before timeout)
  if (state.currentPlayerIndex !== expectedPlayerIndex) return;

  const currentPlayer = state.players[state.currentPlayerIndex];

  // Double-check it's still a human's turn
  if (!currentPlayer.isHuman) return;
  if (state.phase !== 'bidding' && state.phase !== 'playing') return;
  
  log(`Turn timeout for ${currentPlayer.name} in room ${room.code}`, 'ws');
  
  let newState: GameState = { ...state, turnStartTime: undefined };
  
  if (state.phase === 'bidding') {
    // Auto-pass
    newState = { ...gameEngine.processBid(newState, 0), turnStartTime: undefined };
  } else if (state.phase === 'playing') {
    // Auto-play first valid card
    const validCard = currentPlayer.hand.find(card => 
      gameEngine.canPlayCard(card, currentPlayer.hand, state.currentTrick, state.trumpSuit)
    );
    if (validCard) {
      newState = { ...gameEngine.playCard(newState, validCard), turnStartTime: undefined };
    }
  }
  room.gameState = newState;
  
  // Validate no duplicate cards
  gameEngine.validateNoDuplicates(newState, `after turn timeout for ${currentPlayer.name}`);
  
  broadcastGameState(room);
  
  // Process CPU turns if needed
  await processCpuTurns(room);
}

function broadcastGameState(room: GameRoom, preserveExistingTimer = false) {
  if (!room.gameState) return;
  
  // Start/reset turn timer for human players
  const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
  const isTimedPhase = room.gameState.phase === 'bidding' || room.gameState.phase === 'playing';
  const currentTimerForPlayer = turnTimerPlayerIndex.get(room.id);
  const hasActiveTimerHandle = turnTimers.has(room.id);
  
  if (currentPlayer.isHuman && isTimedPhase) {
    // Check for restoration scenario first:
    // If we have a turnStartTime but no timer handle, this is a restoration (reconnect/restart)
    // We should preserve the existing time rather than starting fresh
    if (!hasActiveTimerHandle && room.gameState.turnStartTime) {
      // Timer handle was lost (e.g., reconnect, server restart) - restore with remaining time
      startTurnTimer(room, true);
    } else if (currentTimerForPlayer !== undefined && currentTimerForPlayer !== room.gameState.currentPlayerIndex) {
      // Turn actually changed to a different player - start fresh timer
      startTurnTimer(room, false);
    } else if (!room.gameState.turnStartTime) {
      // No timer running at all - start fresh
      startTurnTimer(room, false);
    }
    // else: timer is already running for current player with active handle, do nothing
  } else {
    // Clear timer if it's not a human's timed turn
    clearTurnTimer(room.id);
    if (room.gameState.turnStartTime) {
      room.gameState = { ...room.gameState, turnStartTime: undefined };
    }
  }
  
  const players = Array.from(room.players.values());
  for (const player of players) {
    const filteredState = filterGameStateForPlayer(room.gameState, player.seatIndex);
    safeSend(player.ws, JSON.stringify({
      type: 'game_state',
      gameState: filteredState,
    }));
  }
}

function broadcastToRoom(room: GameRoom, message: any, excludeWs?: WebSocket) {
  const data = JSON.stringify(message);
  const players = Array.from(room.players.values());
  for (const player of players) {
    if (player.ws && player.ws !== excludeWs) {
      safeSend(player.ws, data);
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
  const chatData = JSON.stringify({ type: 'chat_message', message: chatMessage });
  const players = Array.from(room.players.values());
  for (const p of players) {
    safeSend(p.ws, chatData);
  }
}

export function getRoomByCode(code: string): GameRoom | undefined {
  return rooms.get(code);
}

import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { GameState, DeckColor } from '@shared/gameTypes';
import type { ConnectedPlayer, GameRoom } from './types';
import {
  rooms, playerConnections, lobbyDisconnectTimers, roomCleanupTimers,
  safeSend, generateRoomCode, getPlayerList, broadcastToRoom, getRoomById,
  spectatorConnections,
} from './state';
import { broadcastGameState, filterGameStateForPlayer } from './gameSync';
import { storage } from '../storage';
import { log } from '../index';

const NAME_MAX_LENGTH = 50;

export async function handleCreateRoom(ws: WebSocket, message: any) {
  const { playerName, deckColor = 'blue', targetScore = 25, userId } = message;

  const trimmedName = (playerName?.trim?.() || '').slice(0, NAME_MAX_LENGTH);
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
    spectators: new Map(),
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

export async function handleJoinRoom(ws: WebSocket, message: any) {
  const { roomCode, playerName, playerToken: existingToken, preferredSeat, userId } = message;

  const trimmedName = (playerName?.trim?.() || '').slice(0, NAME_MAX_LENGTH);
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

      room = {
        id: storedRoom.id,
        code: storedRoom.code,
        players: new Map(),
        cpuPlayers: [],
        spectators: new Map(),
        gameState: storedRoom.gameState as GameState | null,
        deckColor: (storedRoom.deckColor || 'blue') as DeckColor,
        targetScore: storedRoom.targetScore || 25,
        chatMessages: [],
      };

      const storedPlayers = await storage.getPlayersInRoom(storedRoom.id);

      const occupiedSeats = new Set<number>();

      for (const storedPlayer of storedPlayers) {
        if (occupiedSeats.has(storedPlayer.seatIndex)) {
          log(`Skipping duplicate player at seat ${storedPlayer.seatIndex}`, 'ws');
          continue;
        }

        if (storedPlayer.isHuman) {
          room.players.set(storedPlayer.playerToken, {
            ws: null as any,
            roomId: storedRoom.id,
            playerToken: storedPlayer.playerToken,
            seatIndex: storedPlayer.seatIndex,
            playerName: storedPlayer.playerName,
          });
          occupiedSeats.add(storedPlayer.seatIndex);
        } else {
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

    const lobbyTimer = lobbyDisconnectTimers.get(existingToken);
    if (lobbyTimer) {
      clearTimeout(lobbyTimer);
      lobbyDisconnectTimers.delete(existingToken);
    }

    log(`Player ${existingPlayer.playerName} rejoined room ${room.code} at seat ${existingPlayer.seatIndex}`, 'ws');

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

  const humanSeats = Array.from(room.players.values()).map(p => p.seatIndex);
  const cpuSeats = room.cpuPlayers.map(cpu => cpu.seatIndex);

  let availableSeat: number | undefined;

  if (typeof preferredSeat === 'number' && preferredSeat >= 0 && preferredSeat <= 3) {
    if (!humanSeats.includes(preferredSeat) && !cpuSeats.includes(preferredSeat)) {
      availableSeat = preferredSeat;
    } else if (!humanSeats.includes(preferredSeat) && cpuSeats.includes(preferredSeat)) {
      room.cpuPlayers = room.cpuPlayers.filter(cpu => cpu.seatIndex !== preferredSeat);
      availableSeat = preferredSeat;
      log(`CPU removed from seat ${preferredSeat} to give player their preferred seat`, 'ws');
    }
  }

  if (availableSeat === undefined) {
    availableSeat = [0, 1, 2, 3].find(seat => !humanSeats.includes(seat) && !cpuSeats.includes(seat));
  }

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

export async function handleLeaveRoom(ws: WebSocket) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = getRoomById(player.roomId);

  if (room) {
    if (room.gameState) {
      player.ws = null as any;
      broadcastToRoom(room, {
        type: 'player_disconnected',
        seatIndex: player.seatIndex,
        players: getPlayerList(room),
      });
      log(`Player ${player.playerName} left active game in room ${room.code}, seat reserved for rejoin`, 'ws');
    } else {
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

export async function handleAddCpu(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = getRoomById(player.roomId);
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

export async function handleRemoveCpu(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = getRoomById(player.roomId);
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

export async function handleKickPlayer(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = getRoomById(player.roomId);
  if (!room) return;

  if (player.seatIndex !== 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Only the host can remove players' }));
    return;
  }

  if (room.gameState) {
    ws.send(JSON.stringify({ type: 'error', message: 'Cannot remove players during game' }));
    return;
  }

  const { seatIndex } = message;

  if (typeof seatIndex !== 'number' || seatIndex < 0 || seatIndex > 3) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid seat index' }));
    return;
  }

  if (seatIndex === 0) {
    ws.send(JSON.stringify({ type: 'error', message: 'Cannot remove yourself' }));
    return;
  }

  const targetPlayer = Array.from(room.players.entries()).find(([_, p]) => p.seatIndex === seatIndex);

  if (!targetPlayer) {
    const cpuIndex = room.cpuPlayers.findIndex(cpu => cpu.seatIndex === seatIndex);
    if (cpuIndex !== -1) {
      room.cpuPlayers.splice(cpuIndex, 1);
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'No player at this seat' }));
      return;
    }
  } else {
    const [token, kickedPlayer] = targetPlayer;

    safeSend(kickedPlayer.ws, JSON.stringify({
      type: 'kicked',
      message: 'You have been removed from the room by the host',
      clearSession: true
    }));

    if (kickedPlayer.ws) {
      playerConnections.delete(kickedPlayer.ws);
    }

    room.players.delete(token);

    log(`Player ${kickedPlayer.playerName} kicked from room ${room.code}`, 'ws');
  }

  broadcastToRoom(room, {
    type: 'player_disconnected',
    seatIndex,
    players: getPlayerList(room),
  });

  log(`Player removed from seat ${seatIndex} in room ${room.code}`, 'ws');
}

export async function handleSwapSeats(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = getRoomById(player.roomId);
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

export async function handleRandomizeTeams(ws: WebSocket) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = getRoomById(player.roomId);
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

export function handlePreviewRoom(ws: WebSocket, message: any) {
  const { roomCode } = message;
  const room = rooms.get(roomCode?.toUpperCase());

  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }

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

export function handlePlayerDisconnect(player: ConnectedPlayer) {
  const room = getRoomById(player.roomId);
  if (!room) return;

  player.ws = null as any;

  if (room.gameState) {
    log(`Player ${player.playerName} disconnected from active game in room ${room.code}`, 'ws');
  } else {
    log(`Player ${player.playerName} disconnected from lobby in room ${room.code}`, 'ws');

    const token = player.playerToken;
    const existingLobbyTimer = lobbyDisconnectTimers.get(token);
    if (existingLobbyTimer) {
      clearTimeout(existingLobbyTimer);
    }
    const lobbyTimer = setTimeout(() => {
      lobbyDisconnectTimers.delete(token);
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

  const connectedPlayers = Array.from(room.players.values()).filter(p => p.ws !== null);

  if (connectedPlayers.length === 0) {
    log(`All players disconnected from room ${room.code}, starting cleanup timer (1 hour)`, 'ws');

    const existingTimer = roomCleanupTimers.get(room.code);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const cleanupTimer = setTimeout(() => {
      const currentRoom = rooms.get(room.code);
      if (currentRoom) {
        const stillConnected = Array.from(currentRoom.players.values()).filter(p => p.ws !== null);
        if (stillConnected.length === 0) {
          log(`Cleaning up room ${room.code} after 1 hour of inactivity`, 'ws');

          const roomSpectators = Array.from(currentRoom.spectators.values());
          for (const spectator of roomSpectators) {
            safeSend(spectator.ws, JSON.stringify({ type: 'room_unavailable', message: 'The game has ended' }));
            spectatorConnections.delete(spectator.ws);
          }
          currentRoom.spectators.clear();

          if (currentRoom.gameState) {
            currentRoom.gameState = null;
            currentRoom.chatMessages = [];
          }
          currentRoom.cpuPlayers = [];
          currentRoom.players.clear();

          storage.updateRoom(currentRoom.id, {
            gameState: null,
            status: 'waiting'
          }).catch(err => log(`Failed to reset room in DB: ${err}`, 'ws'));

          rooms.delete(room.code);
          roomCleanupTimers.delete(room.code);
          log(`Room ${room.code} removed from memory after cleanup`, 'ws');
        }
      }
      roomCleanupTimers.delete(room.code);
    }, 60 * 60 * 1000);

    roomCleanupTimers.set(room.code, cleanupTimer);
  } else {
    const existingTimer = roomCleanupTimers.get(room.code);
    if (existingTimer) {
      clearTimeout(existingTimer);
      roomCleanupTimers.delete(room.code);
      log(`Cleanup timer cancelled for room ${room.code} - player still connected`, 'ws');
    }
  }
}

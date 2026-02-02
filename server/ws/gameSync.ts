import { WebSocket } from 'ws';
import type { GameState, Card, Suit } from '@shared/gameTypes';
import { MIN_BID, MAX_BID } from '@shared/gameTypes';
import * as gameEngine from '@shared/gameEngine';
import type { GameRoom } from './types';
import {
  rooms, playerConnections, turnTimers, turnTimerPlayerIndex,
  safeSend, getRoomById, getPlayerList, broadcastToRoom,
  TURN_TIMEOUT_MS, TURN_TIMEOUT_BUFFER_MS,
} from './state';
import { trackPlayerStats } from './statsTracker';
import { storage } from '../storage';
import { log } from '../index';

// ── State Filtering ──

export function filterGameStateForPlayer(state: GameState, seatIndex: number): GameState {
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

export function filterGameStateForSpectator(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => {
      const trumpCount = state.trumpSuit ? p.hand.filter(c => c.suit === state.trumpSuit).length : 0;
      return {
        ...p,
        hand: p.hand.map(() => ({ rank: '2', suit: 'Spades', id: 'hidden' } as Card)),
        trumpCount,
      };
    }),
    stock: [],
    discardPile: [],
  };
}

// ── Turn Timer ──

export function clearTurnTimer(roomId: string) {
  const existingTimer = turnTimers.get(roomId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    turnTimers.delete(roomId);
  }
  turnTimerPlayerIndex.delete(roomId);
}

export function startTurnTimer(room: GameRoom, preserveExistingTime = false) {
  if (!room.gameState) return;

  const existingTimer = turnTimers.get(room.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
    turnTimers.delete(room.id);
  }

  const state = room.gameState;
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (!currentPlayer.isHuman) return;
  if (state.phase !== 'bidding' && state.phase !== 'playing') return;

  let turnStartTime: number;
  let remainingMs: number;

  if (preserveExistingTime && room.gameState.turnStartTime) {
    turnStartTime = room.gameState.turnStartTime;
    const elapsed = Date.now() - turnStartTime;
    remainingMs = Math.max(0, TURN_TIMEOUT_MS - elapsed);

    if (remainingMs <= 0) {
      handleTurnTimeout(room, state.currentPlayerIndex);
      return;
    }
  } else {
    turnStartTime = Date.now();
    remainingMs = TURN_TIMEOUT_MS;

    room.gameState = {
      ...room.gameState,
      turnStartTime,
    };
  }

  const expectedPlayerIndex = state.currentPlayerIndex;
  turnTimerPlayerIndex.set(room.id, expectedPlayerIndex);

  const timer = setTimeout(() => {
    handleTurnTimeout(room, expectedPlayerIndex);
  }, remainingMs + TURN_TIMEOUT_BUFFER_MS);

  turnTimers.set(room.id, timer);
}

async function handleTurnTimeout(room: GameRoom, expectedPlayerIndex: number) {
  clearTurnTimer(room.id);

  if (!room.gameState) return;

  const state = room.gameState;

  if (state.currentPlayerIndex !== expectedPlayerIndex) return;

  const currentPlayer = state.players[state.currentPlayerIndex];

  if (!currentPlayer.isHuman) return;
  if (state.phase !== 'bidding' && state.phase !== 'playing') return;

  log(`Turn timeout for ${currentPlayer.name} in room ${room.code}`, 'ws');

  let newState: GameState = { ...state, turnStartTime: undefined };

  if (state.phase === 'bidding') {
    newState = { ...gameEngine.processBid(newState, 0), turnStartTime: undefined };
  } else if (state.phase === 'playing') {
    const validCard = currentPlayer.hand.find(card =>
      gameEngine.canPlayCard(card, currentPlayer.hand, state.currentTrick, state.trumpSuit)
    );
    if (validCard) {
      newState = { ...gameEngine.playCard(newState, validCard), turnStartTime: undefined };
    }
  }
  room.gameState = newState;

  gameEngine.validateNoDuplicates(newState, `after turn timeout for ${currentPlayer.name}`);

  broadcastGameState(room);

  await processCpuTurns(room);
}

// ── Broadcast ──

export function broadcastGameState(room: GameRoom) {
  if (!room.gameState) return;

  const currentPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
  const isTimedPhase = room.gameState.phase === 'bidding' || room.gameState.phase === 'playing';
  const currentTimerForPlayer = turnTimerPlayerIndex.get(room.id);
  const hasActiveTimerHandle = turnTimers.has(room.id);

  if (currentPlayer.isHuman && isTimedPhase) {
    if (!hasActiveTimerHandle && room.gameState.turnStartTime) {
      startTurnTimer(room, true);
    } else if (currentTimerForPlayer !== undefined && currentTimerForPlayer !== room.gameState.currentPlayerIndex) {
      startTurnTimer(room, false);
    } else if (!room.gameState.turnStartTime) {
      startTurnTimer(room, false);
    }
  } else {
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

  if (room.spectators.size > 0) {
    const spectatorState = filterGameStateForSpectator(room.gameState);
    const spectatorData = JSON.stringify({ type: 'game_state', gameState: spectatorState });
    const spectators = Array.from(room.spectators.values());
    for (const spectator of spectators) {
      safeSend(spectator.ws, spectatorData);
    }
  }
}

// ── Game Actions ──

export async function handleStartGame(ws: WebSocket) {
  const player = playerConnections.get(ws);
  if (!player) return;

  const room = getRoomById(player.roomId);
  if (!room) return;

  const playerList = getPlayerList(room);
  if (playerList.length !== 4) {
    ws.send(JSON.stringify({ type: 'error', message: 'Need exactly 4 players to start' }));
    return;
  }

  let state = gameEngine.initializeGame(room.deckColor, room.targetScore);

  room.gameInstanceId = (room.gameInstanceId || 0) + 1;
  room.lastProcessedRoundSignature = undefined;
  room.lastProcessedGame = room.gameInstanceId;

  const connectedPlayers = Array.from(room.players.values());
  state.players = state.players.map((p, index) => {
    const connectedPlayer = connectedPlayers.find(cp => cp.seatIndex === index);
    const cpuPlayer = room.cpuPlayers.find(cpu => cpu.seatIndex === index);

    if (connectedPlayer) {
      return { ...p, name: connectedPlayer.playerName, isHuman: true };
    } else if (cpuPlayer) {
      return { ...p, name: cpuPlayer.playerName, isHuman: false };
    }
    return { ...p, name: `CPU ${index + 1}`, isHuman: false };
  });

  state = gameEngine.startDealerDraw(state);
  room.gameState = state;

  gameEngine.validateNoDuplicates(state, 'after game start/dealer draw');

  broadcastGameState(room);
  log(`Game started in room ${room.code}`, 'ws');
}

export async function handlePlayerAction(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  if (!player) {
    log(`[Action] Error: Player not in a room`, 'game');
    ws.send(JSON.stringify({ type: 'error', message: 'Not connected to a room' }));
    return;
  }

  const room = getRoomById(player.roomId);
  if (!room || !room.gameState) {
    log(`[Action] Error: Game not found for room ${player.roomId}`, 'game');
    ws.send(JSON.stringify({ type: 'error', message: 'Game not found' }));
    return;
  }

  log(`[Action] Room ${room.code} | Seat ${player.seatIndex} | Action: ${message.action} | Phase: ${room.gameState.phase}`, 'game');

  const phase = room.gameState.phase;
  const isAnyPlayerPhase = phase === 'dealer-draw' || phase === 'purge-draw' || phase === 'scoring' || phase === 'game-over';
  const isPlayerAction = message.action === 'sort_hand';

  if (room.gameState.currentPlayerIndex !== player.seatIndex && !isAnyPlayerPhase && !isPlayerAction) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not your turn' }));
    return;
  }

  const { action, data } = message;

  if (!action || typeof action !== 'string') {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid action' }));
    return;
  }

  if (action === 'bid' || action === 'play_card') {
    clearTurnTimer(room.id);
  }

  let newState = room.gameState;

  if (action === 'bid' || action === 'play_card') {
    newState = { ...newState, turnStartTime: undefined };
  }

  switch (action) {
    case 'finalize_dealer_draw':
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
      log(`[Continue] Room ${room.code} | Current phase: ${newState.phase} | GameOver: ${gameEngine.checkGameOver(newState)}`, 'game');
      if (newState.phase === 'scoring' || newState.phase === 'game-over') {
        if (gameEngine.checkGameOver(newState)) {
          log(`[Continue] Room ${room.code} | Starting new game`, 'game');
          newState = gameEngine.initializeGame(room.deckColor, room.targetScore);
          const connectedPlayers = Array.from(room.players.values());
          newState.players = newState.players.map((p, index) => {
            const cp = connectedPlayers.find(c => c.seatIndex === index);
            const cpu = room.cpuPlayers.find(c => c.seatIndex === index);
            if (cp) return { ...p, name: cp.playerName, isHuman: true };
            if (cpu) return { ...p, name: cpu.playerName, isHuman: false };
            return { ...p, name: `CPU ${index + 1}`, isHuman: false };
          });
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

  if (previousPhase !== newState.phase) {
    storage.updateRoom(room.id, { gameState: newState }).catch(err =>
      log(`Failed to persist game state: ${err}`, 'ws')
    );
  }

  gameEngine.validateNoDuplicates(newState, `after action: ${action}`);

  const newPhaseStr = newState.phase as string;
  if ((previousPhase !== 'scoring' && previousPhase !== 'game-over') &&
      (newPhaseStr === 'scoring' || newPhaseStr === 'game-over')) {
    await trackPlayerStats(room, previousPhase);
  }

  broadcastGameState(room);

  await processCpuTurns(room);
}

export async function processCpuTurns(room: GameRoom) {
  if (!room.gameState) return;

  let state = room.gameState;
  let previousPhase = state.phase;

  while (state.phase !== 'scoring' && state.phase !== 'game-over' && state.phase !== 'purge-draw') {
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer.isHuman) break;
    previousPhase = state.phase;

    const baseDelay = 1200 + Math.random() * 300;
    await new Promise(resolve => setTimeout(resolve, baseDelay));

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

    gameEngine.validateNoDuplicates(state, `after CPU action in phase: ${state.phase}`);

    const newPhase = state.phase as string;
    const prevPhaseStr = previousPhase as string;
    if ((prevPhaseStr !== 'scoring' && prevPhaseStr !== 'game-over') &&
        (newPhase === 'scoring' || newPhase === 'game-over')) {
      await trackPlayerStats(room, prevPhaseStr);
    }

    broadcastGameState(room);

    if (trickLengthBefore === 3 && state.currentTrick.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      if (!room.gameState) return;
      state = room.gameState;
    }
  }
}

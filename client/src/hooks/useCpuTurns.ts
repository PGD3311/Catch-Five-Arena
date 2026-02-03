import { useEffect, type Dispatch, type SetStateAction, type MutableRefObject } from 'react';
import type { GameState, Suit, TrickCard } from '@shared/gameTypes';
import { TOTAL_TRICKS } from '@shared/gameTypes';
import {
  processBid,
  getCpuBid,
  getCpuTrumpChoice,
  getCpuTrumpToDiscard,
  getCpuCardToPlay,
  discardTrumpCard,
  playCard,
} from '@shared/gameEngine';

interface UseCpuTurnsOptions {
  gameState: GameState;
  setGameState: Dispatch<SetStateAction<GameState>>;
  isMultiplayerMode: boolean;
  displayTrick: TrickCard[];
  setDisplayTrick: Dispatch<SetStateAction<TrickCard[]>>;
  trickWinnerTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  handleTrumpSelect: (suit: Suit) => void;
}

export function useCpuTurns({
  gameState,
  setGameState,
  isMultiplayerMode,
  displayTrick,
  setDisplayTrick,
  trickWinnerTimeoutRef,
  handleTrumpSelect,
}: UseCpuTurnsOptions) {
  // CPU bidding
  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase === 'bidding') {
      const currentPlayer = gameState.players[gameState.currentPlayerIndex];
      if (!currentPlayer.isHuman) {
        const baseDelay = 1000 + Math.random() * 500;
        const timer = setTimeout(() => {
          const passedCount = gameState.players.filter(p => p.bid === 0).length;
          const isDealer = gameState.currentPlayerIndex === gameState.dealerIndex;
          const isLastAndAllPassed = isDealer && passedCount === 3;
          const cpuBid = getCpuBid(currentPlayer.hand, gameState.highBid, isDealer, isLastAndAllPassed);
          setGameState(prev => processBid(prev, cpuBid));
        }, baseDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.highBid, gameState.dealerIndex, isMultiplayerMode, setGameState]);

  // CPU trump selection
  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase === 'trump-selection') {
      const bidder = gameState.players.find(p => p.id === gameState.bidderId);
      if (bidder && !bidder.isHuman) {
        const timer = setTimeout(() => {
          const wasForcedBid = gameState.highBid === 5 &&
            gameState.players.filter(p => p.bid === 0).length === 3;
          const bestSuit = getCpuTrumpChoice(bidder.hand, wasForcedBid);
          handleTrumpSelect(bestSuit);
        }, 1000 + Math.random() * 400);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState.phase, gameState.players, gameState.bidderId, gameState.highBid, isMultiplayerMode, handleTrumpSelect]);

  // CPU trump discard
  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase !== 'discard-trump') return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.isHuman) {
      const timer = setTimeout(() => {
        const cardToDiscard = getCpuTrumpToDiscard(currentPlayer.hand, gameState.trumpSuit!);
        setGameState(prev => discardTrumpCard(prev, cardToDiscard));
      }, 1000 + Math.random() * 400);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.trumpSuit, isMultiplayerMode, setGameState]);

  // CPU card play
  useEffect(() => {
    if (isMultiplayerMode) return;
    if (gameState.phase !== 'playing') return;
    if (displayTrick.length > 0) return;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer.isHuman && currentPlayer.hand.length > 0) {
      const baseDelay = 1200 + Math.random() * 600;
      const timer = setTimeout(() => {
        setGameState(prev => {
          if (prev.phase !== 'playing') return prev;
          if (prev.players[prev.currentPlayerIndex].isHuman) return prev;
          if (prev.players[prev.currentPlayerIndex].id !== currentPlayer.id) return prev;

          const cardToPlay = getCpuCardToPlay(
            prev.players[prev.currentPlayerIndex].hand,
            prev.currentTrick,
            prev.trumpSuit,
            currentPlayer.id,
            prev.players,
            prev.bidderId
          );

          const newTrick = [...prev.currentTrick, { playerId: currentPlayer.id, card: cardToPlay }];

          if (newTrick.length === 4 && prev.trumpSuit) {
            setDisplayTrick(newTrick);

            if (trickWinnerTimeoutRef.current) {
              clearTimeout(trickWinnerTimeoutRef.current);
            }
            const cpuHasPoints = prev.trumpSuit && newTrick.some(tc =>
              tc.card.suit === prev.trumpSuit &&
              (tc.card.rank === '5' || tc.card.rank === 'A' || tc.card.rank === 'J'));
            const cpuTrickHold = (prev.trickNumber >= TOTAL_TRICKS && cpuHasPoints) ? 3500 : 2500;
            trickWinnerTimeoutRef.current = setTimeout(() => {
              setDisplayTrick([]);
              setGameState(prevInner => playCard(prevInner, cardToPlay));
            }, cpuTrickHold);
            return prev;
          } else {
            return playCard(prev, cardToPlay);
          }
        });
      }, baseDelay);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, gameState.currentPlayerIndex, gameState.players, gameState.currentTrick, gameState.trumpSuit, isMultiplayerMode, displayTrick.length, setGameState, setDisplayTrick, trickWinnerTimeoutRef]);
}

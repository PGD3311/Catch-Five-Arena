import { createContext, useContext, useMemo, ReactNode } from 'react';
import type { GameState } from '@shared/gameTypes';
import { computeTension } from '@shared/tensionEngine';

interface TensionContextValue {
  tension: number;
}

const TensionContext = createContext<TensionContextValue>({ tension: 0 });

interface TensionProviderProps {
  gameState: GameState;
  children: ReactNode;
}

export function TensionProvider({ gameState, children }: TensionProviderProps) {
  // Scalar proxy for total tricksWon count — avoids array reference churn
  const totalTricksWon = gameState.players.reduce(
    (sum, p) => sum + p.tricksWon.length,
    0,
  );

  const tension = useMemo(
    () => computeTension(gameState),
    [
      gameState.phase,
      gameState.teams[0]?.score,
      gameState.teams[1]?.score,
      gameState.targetScore,
      gameState.highBid,
      gameState.bidderId,
      gameState.trickNumber,
      gameState.trumpSuit,
      totalTricksWon,
    ],
  );

  const value = useMemo(() => ({ tension }), [tension]);

  return (
    <TensionContext.Provider value={value}>
      {children}
    </TensionContext.Provider>
  );
}

export function useTension(): TensionContextValue {
  return useContext(TensionContext);
}

import { useState, useEffect, useRef } from 'react';
import { TrickCard, Player, Suit } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { Catch5Effect } from './Catch5Effect';
import { motion, AnimatePresence } from 'framer-motion';

interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: Player[];
  trumpSuit?: Suit | null;
  mySeatIndex?: number;
  onShake?: () => void;
}

export function TrickArea({ currentTrick, players, trumpSuit, mySeatIndex = 0, onShake }: TrickAreaProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const [catch5CardId, setCatch5CardId] = useState<string | null>(null);
  const firedCatch5Ref = useRef<string | null>(null);
  const prevTrickLenRef = useRef(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear catch5 state when trick resets (new trick starts)
  useEffect(() => {
    if (currentTrick.length < prevTrickLenRef.current) {
      setCatch5CardId(null);
      firedCatch5Ref.current = null;
    }
    prevTrickLenRef.current = currentTrick.length;
  }, [currentTrick.length]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  // Detect catch-5 combo: a trump 5 played after the trump Ace by a teammate
  const detectCatch5 = (): string | null => {
    if (!trumpSuit) return null;

    for (let i = 1; i < currentTrick.length; i++) {
      const card = currentTrick[i];
      if (card.card.rank !== '5' || card.card.suit !== trumpSuit) continue;

      for (let j = 0; j < i; j++) {
        const earlier = currentTrick[j];
        if (earlier.card.rank !== 'A' || earlier.card.suit !== trumpSuit) continue;

        // Check same team
        const fivePlayer = players.find(p => p.id === card.playerId);
        const acePlayer = players.find(p => p.id === earlier.playerId);
        if (fivePlayer && acePlayer && fivePlayer.teamId === acePlayer.teamId) {
          return card.card.id;
        }
      }
    }
    return null;
  };

  // Run detection whenever trick updates
  useEffect(() => {
    const detected = detectCatch5();
    if (detected && detected !== firedCatch5Ref.current) {
      firedCatch5Ref.current = detected;
      setCatch5CardId(detected);
      // Auto-clear visual effect after animations finish
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setCatch5CardId(null), 1600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrick]);

  const getVisualIndex = (playerId: string): number => {
    const seatIndex = players.findIndex(p => p.id === playerId);
    return (seatIndex - mySeatIndex + 4) % 4;
  };

  const getPositionForPlayer = (playerId: string): { x: number; y: number; rotate: number } => {
    const visualIndex = getVisualIndex(playerId);
    const xOffset = isMobile ? 42 : 70;
    const yOffset = isMobile ? 32 : 50;
    switch (visualIndex) {
      case 0: return { x: 0, y: yOffset, rotate: 0 };
      case 1: return { x: -xOffset, y: 0, rotate: -4 };
      case 2: return { x: 0, y: -yOffset, rotate: 0 };
      case 3: return { x: xOffset, y: 0, rotate: 4 };
      default: return { x: 0, y: 0, rotate: 0 };
    }
  };

  const getStartPosition = (playerId: string): { x: number; y: number } => {
    const visualIndex = getVisualIndex(playerId);
    switch (visualIndex) {
      case 0: return { x: 0, y: 140 };
      case 1: return { x: -140, y: 0 };
      case 2: return { x: 0, y: -140 };
      case 3: return { x: 140, y: 0 };
      default: return { x: 0, y: 0 };
    }
  };

  return (
    <div className="relative w-full h-36 sm:h-48 md:h-56" data-testid="trick-area">
      {/* Felt table surface */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-44 h-28 sm:w-56 sm:h-36 md:w-72 md:h-44 rounded-2xl felt-surface noise-overlay border border-white/[0.04] overflow-hidden">
          {/* Inner highlight rim */}
          <div className="absolute inset-[1px] rounded-2xl ring-1 ring-inset ring-white/[0.06]" />
          {/* Center glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--felt-glow)/0.1)_0%,_transparent_60%)]" />
        </div>
      </div>

      {/* Cards in trick */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          {currentTrick.map((trickCard, index) => {
            const pos = getPositionForPlayer(trickCard.playerId);
            const startPos = getStartPosition(trickCard.playerId);
            const isSlam = trickCard.card.id === catch5CardId;

            const springTransition = isSlam
              ? { type: "spring" as const, stiffness: 600, damping: 16, mass: 1.2 }
              : { type: "spring" as const, stiffness: 280, damping: 24, mass: 0.7 };

            return (
              <motion.div
                key={trickCard.card.id}
                initial={{
                  x: startPos.x,
                  y: startPos.y,
                  scale: 0.7,
                  opacity: 0,
                  rotate: pos.rotate - 8
                }}
                animate={{
                  x: pos.x,
                  y: pos.y,
                  scale: isSlam ? [0.7, 1.15, 1] : 1,
                  opacity: 1,
                  rotate: pos.rotate
                }}
                exit={{
                  scale: 0.4,
                  opacity: 0,
                  y: -40
                }}
                transition={springTransition}
                className="absolute"
                style={{ zIndex: isSlam ? 10 : index + 1 }}
              >
                <PlayingCard card={trickCard.card} small trumpSuit={trumpSuit} />
                {isSlam && <Catch5Effect onShake={onShake} />}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

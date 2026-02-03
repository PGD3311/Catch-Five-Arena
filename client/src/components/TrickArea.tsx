import { useState, useEffect, useRef, useMemo } from 'react';
import { TrickCard, Player, Suit, Card } from '@shared/gameTypes';
import { TOTAL_TRICKS } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { Catch5Effect } from './Catch5Effect';
import { motion, AnimatePresence } from 'framer-motion';
import { useTension } from '@/hooks/useTension';

interface CardConfig {
  spring: { type: 'spring'; stiffness: number; damping: number; mass: number };
  scale: number | number[];
  glowClass: string | null;
}

// Stable scale keyframe references — prevents Framer Motion from
// replaying bounce animations when the parent re-renders.
const SLAM_SCALE: number[] = [0.7, 1.15, 1];
const FIVE_FINAL_SCALE: number[] = [0.7, 1.1, 1];
const ACE_JACK_FINAL_SCALE: number[] = [0.7, 1.06, 1];

function getCardConfig(
  card: Card,
  index: number,
  trickNumber: number,
  trumpSuit: Suit | null | undefined,
  isSlam: boolean,
): CardConfig {
  const isTrump = trumpSuit && card.suit === trumpSuit;
  const isFive = isTrump && card.rank === '5';
  const isAceOrJack = isTrump && (card.rank === 'A' || card.rank === 'J');
  const isFinalTrick = trickNumber >= TOTAL_TRICKS;
  const isFourthCard = index === 3;

  // Priority 1: Catch-5 slam — always wins
  if (isSlam) {
    return {
      spring: { type: 'spring', stiffness: 600, damping: 16, mass: 1.2 },
      scale: SLAM_SCALE,
      glowClass: null,
    };
  }

  // Priority 2: Trick 6 + Five of trump
  if (isFinalTrick && isFive) {
    return {
      spring: { type: 'spring', stiffness: 480, damping: 16, mass: 0.9 },
      scale: FIVE_FINAL_SCALE,
      glowClass: 'point-card-glow',
    };
  }

  // Priority 3: Trick 6 + Ace/Jack of trump
  if (isFinalTrick && isAceOrJack) {
    return {
      spring: { type: 'spring', stiffness: 420, damping: 18, mass: 0.8 },
      scale: ACE_JACK_FINAL_SCALE,
      glowClass: 'point-card-flash',
    };
  }

  // Priority 4: Trick 6 + 4th card (resolves trick)
  if (isFinalTrick && isFourthCard) {
    return {
      spring: { type: 'spring', stiffness: 450, damping: 18, mass: 0.8 },
      scale: 1,
      glowClass: null,
    };
  }

  // Priority 5: Trick 6 + routine card
  if (isFinalTrick) {
    return {
      spring: { type: 'spring', stiffness: 380, damping: 20, mass: 0.7 },
      scale: 1,
      glowClass: null,
    };
  }

  // Priority 6: Tricks 1-5 + Five of trump
  if (isFive) {
    return {
      spring: { type: 'spring', stiffness: 340, damping: 20, mass: 0.7 },
      scale: 1,
      glowClass: 'point-card-flash',
    };
  }

  // Priority 7: Tricks 1-5 + Ace/Jack of trump
  if (isAceOrJack) {
    return {
      spring: { type: 'spring', stiffness: 310, damping: 22, mass: 0.7 },
      scale: 1,
      glowClass: null,
    };
  }

  // Priority 8: Routine (default)
  return {
    spring: { type: 'spring', stiffness: 280, damping: 24, mass: 0.7 },
    scale: 1,
    glowClass: null,
  };
}

interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: Player[];
  trumpSuit?: Suit | null;
  mySeatIndex?: number;
  onShake?: () => void;
  trickNumber?: number;
}

export function TrickArea({ currentTrick, players, trumpSuit, mySeatIndex = 0, onShake, trickNumber = 1 }: TrickAreaProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const [catch5CardId, setCatch5CardId] = useState<string | null>(null);
  const firedCatch5Ref = useRef<string | null>(null);
  const slamAnimatedRef = useRef<Set<string>>(new Set());
  const prevTrickLenRef = useRef(0);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { tension } = useTension();

  // Tension-driven felt glow: green (150) → gold (42)
  const feltGlowStyle = useMemo(() => {
    const hue = 150 - tension * 108;          // 150 → 42
    const opacity = 0.10 + tension * 0.20;    // 0.10 → 0.30
    const radius = 60 + tension * 15;         // 60% → 75%

    const style: React.CSSProperties = {
      background: `radial-gradient(ellipse at center, hsla(${hue}, 50%, 40%, ${opacity}) 0%, transparent ${radius}%)`,
      transition: 'background 1s ease',
    };

    // Outer glow shadow on the felt surface when tension > 0.3
    if (tension > 0.3) {
      const shadowOpacity = (tension - 0.3) * 0.15; // 0 → ~0.105
      style.boxShadow = `0 0 40px hsla(${hue}, 50%, 40%, ${shadowOpacity})`;
    }

    return style;
  }, [tension]);

  // Clear catch5 state when trick resets (new trick starts)
  useEffect(() => {
    if (currentTrick.length < prevTrickLenRef.current) {
      setCatch5CardId(null);
      firedCatch5Ref.current = null;
      slamAnimatedRef.current.clear();
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
        <div
          className="relative w-44 h-28 sm:w-56 sm:h-36 md:w-72 md:h-44 rounded-2xl felt-surface noise-overlay border border-white/[0.04] overflow-hidden"
          style={tension > 0.3 ? { boxShadow: feltGlowStyle.boxShadow } : undefined}
        >
          {/* Inner highlight rim */}
          <div className="absolute inset-[1px] rounded-2xl ring-1 ring-inset ring-white/[0.06]" />
          {/* Center glow — tension-driven */}
          <div className="absolute inset-0" style={feltGlowStyle} />
        </div>
      </div>

      {/* Cards in trick */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          {currentTrick.map((trickCard, index) => {
            const pos = getPositionForPlayer(trickCard.playerId);
            const startPos = getStartPosition(trickCard.playerId);
            const isSlam = trickCard.card.id === catch5CardId;
            const config = getCardConfig(trickCard.card, index, trickNumber, trumpSuit, isSlam);

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
                  scale: config.scale,
                  opacity: 1,
                  rotate: pos.rotate
                }}
                exit={{
                  scale: 0.4,
                  opacity: 0,
                  y: -40
                }}
                transition={config.spring}
                className={`absolute ${config.glowClass ?? ''}`}
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

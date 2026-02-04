import { useState, useEffect, useRef } from 'react';
import { TrickCard, Player, Suit, Card, determineTrickWinner } from '@shared/gameTypes';

import { PlayingCard } from './PlayingCard';
import { Catch5Effect, resetShownEffects } from './Catch5Effect';
import { PahtnahSlam } from './PahtnahSlam';
import { motion, AnimatePresence } from 'framer-motion';


interface CardConfig {
  spring: { type: 'spring'; stiffness: number; damping: number; mass: number };
  scale: number | number[];
  glowClass: string | null;
}

// Stable scale keyframe references — prevents Framer Motion from
// replaying bounce animations when the parent re-renders.
const SLAM_SCALE: number[] = [0.7, 1.15, 1];
const PAHTNAH_SLAM_SCALE: number[] = [1.8, 1.05, 1];

function getCardConfig(
  card: Card,
  trumpSuit: Suit | null | undefined,
  isSlam: boolean,
  alreadySlammed: boolean,
  isPahtnahSlam: boolean,
  alreadyPahtnahSlammed: boolean,
): CardConfig {
  const isTrump = trumpSuit && card.suit === trumpSuit;
  const isFive = isTrump && card.rank === '5';
  const isAceOrJack = isTrump && (card.rank === 'A' || card.rank === 'J');

  // Priority 0: Pahtnah slam on the 5 card — hard/fast slam-down
  if (isPahtnahSlam) {
    return {
      spring: { type: 'spring', stiffness: 600, damping: 15, mass: 1.2 },
      scale: PAHTNAH_SLAM_SCALE,
      glowClass: null,
    };
  }

  // Pahtnah-slammed card that already animated — hold at scale 1
  if (alreadyPahtnahSlammed) {
    return {
      spring: { type: 'spring', stiffness: 280, damping: 24, mass: 0.7 },
      scale: 1,
      glowClass: null,
    };
  }

  // Priority 1: Catch-5 slam — initial bounce
  if (isSlam) {
    return {
      spring: { type: 'spring', stiffness: 600, damping: 16, mass: 1.2 },
      scale: SLAM_SCALE,
      glowClass: null,
    };
  }

  // Slam card that already animated — hold at scale 1 so popLayout
  // re-renders don't fall through to trick-6 effects and replay a bounce.
  if (alreadySlammed) {
    return {
      spring: { type: 'spring', stiffness: 280, damping: 24, mass: 0.7 },
      scale: 1,
      glowClass: null,
    };
  }

  // Priority 2: Five of trump (any trick)
  if (isFive) {
    return {
      spring: { type: 'spring', stiffness: 340, damping: 20, mass: 0.7 },
      scale: 1,
      glowClass: 'point-card-flash',
    };
  }

  // Priority 3: Ace/Jack of trump (any trick)
  if (isAceOrJack) {
    return {
      spring: { type: 'spring', stiffness: 310, damping: 22, mass: 0.7 },
      scale: 1,
      glowClass: null,
    };
  }

  // Priority 4: Routine (default)
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
  onPahtnahSlam?: () => void;
}

export function TrickArea({ currentTrick, players, trumpSuit, mySeatIndex = 0, onShake, onPahtnahSlam }: TrickAreaProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const [catch5CardId, setCatch5CardId] = useState<string | null>(null);
  const [pahtnahActive, setPahtnahActive] = useState(false);
  const firedCatch5Ref = useRef<string | null>(null);
  const firedPahtnahRef = useRef<string | null>(null);
  const pahtnahAnimatedRef = useRef<Set<string>>(new Set());
  const slamAnimatedRef = useRef<Set<string>>(new Set());
  const prevTrickLenRef = useRef(0);

  // Clear catch5 + pahtnah state when trick resets (new trick starts)
  useEffect(() => {
    if (currentTrick.length < prevTrickLenRef.current) {
      setCatch5CardId(null);
      setPahtnahActive(false);
      firedCatch5Ref.current = null;
      firedPahtnahRef.current = null;
      slamAnimatedRef.current.clear();
      pahtnahAnimatedRef.current.clear();
      resetShownEffects();
    }
    prevTrickLenRef.current = currentTrick.length;
  }, [currentTrick.length]);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrick]);

  // Detect pahtnah slam: Ace of trump played, then partner plays 5 of trump
  // on the same trick. Distinct from catch-5 — this is the "THAT'S MY PAHTNAH!" overlay.
  const detectPahtnahSlam = (): string | null => {
    if (!trumpSuit) return null;

    for (let i = 1; i < currentTrick.length; i++) {
      const card = currentTrick[i];
      if (card.card.rank !== '5' || card.card.suit !== trumpSuit) continue;

      for (let j = 0; j < i; j++) {
        const earlier = currentTrick[j];
        if (earlier.card.rank !== 'A' || earlier.card.suit !== trumpSuit) continue;

        const fivePlayer = players.find(p => p.id === card.playerId);
        const acePlayer = players.find(p => p.id === earlier.playerId);
        if (fivePlayer && acePlayer && fivePlayer.teamId === acePlayer.teamId) {
          return card.card.id;
        }
      }
    }
    return null;
  };

  // Run pahtnah detection whenever trick updates
  useEffect(() => {
    const detected = detectPahtnahSlam();
    if (detected && detected !== firedPahtnahRef.current) {
      firedPahtnahRef.current = detected;
      setPahtnahActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrick]);

  // After a slam card renders with SLAM_SCALE, mark it so subsequent
  // renders use scale: 1 — prevents popLayout from replaying the bounce.
  useEffect(() => {
    if (catch5CardId && !slamAnimatedRef.current.has(catch5CardId)) {
      slamAnimatedRef.current.add(catch5CardId);
    }
  }, [catch5CardId]);

  // Same pattern for pahtnah slam cards
  useEffect(() => {
    if (firedPahtnahRef.current && !pahtnahAnimatedRef.current.has(firedPahtnahRef.current)) {
      pahtnahAnimatedRef.current.add(firedPahtnahRef.current);
    }
  }, [pahtnahActive]);

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
      {/* Table — wood rail + inset felt */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: '600px' }}>
        {/* Wood rail */}
        <div
          className="relative w-48 h-32 sm:w-60 sm:h-40 md:w-80 md:h-48 rounded-[20px] sm:rounded-[24px] table-rail"
          style={{
            transform: 'rotateX(2deg)',
            transformOrigin: 'center 60%',
          }}
        >
          {/* Rail top bevel highlight */}
          <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-[inherit] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

          {/* Inset felt playing surface */}
          <div
            className={`absolute inset-[5px] sm:inset-[6px] md:inset-[7px] rounded-[15px] sm:rounded-[18px] felt-surface noise-overlay felt-lamp overflow-hidden ${pahtnahActive ? 'table-slam-shake' : ''}`}
          >
            {/* Inner felt edge highlight — light catching the near lip */}
            <div className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.04]" />
          </div>
        </div>
      </div>

      {/* Cards in trick */}
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          {(() => {
            const sweepTarget = currentTrick.length === 4
              ? getStartPosition(determineTrickWinner(currentTrick, trumpSuit ?? null))
              : null;
            return currentTrick.map((trickCard, index) => {
            const pos = getPositionForPlayer(trickCard.playerId);
            const startPos = getStartPosition(trickCard.playerId);
            const isSlam = trickCard.card.id === catch5CardId;
            // First render: SLAM_SCALE plays. After that: scale 1 so
            // popLayout re-animation produces no visible bounce.
            const isNewSlam = isSlam && !slamAnimatedRef.current.has(trickCard.card.id);
            const alreadySlammed = isSlam && slamAnimatedRef.current.has(trickCard.card.id);
            // Pahtnah slam on the 5 card itself
            const isPahtnahCard = trickCard.card.id === firedPahtnahRef.current;
            const isNewPahtnah = isPahtnahCard && !pahtnahAnimatedRef.current.has(trickCard.card.id);
            const alreadyPahtnah = isPahtnahCard && pahtnahAnimatedRef.current.has(trickCard.card.id);
            const config = getCardConfig(trickCard.card, trumpSuit, isNewSlam, alreadySlammed, isNewPahtnah, alreadyPahtnah);

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
                exit={sweepTarget
                  ? {
                      x: sweepTarget.x,
                      y: sweepTarget.y,
                      scale: 0.5,
                      opacity: 0,
                      transition: { duration: 0.4, ease: 'easeIn' },
                    }
                  : {
                      scale: 0.4,
                      opacity: 0,
                      y: -40,
                    }
                }
                transition={config.spring}
                className={`absolute ${config.glowClass ?? ''}`}
                style={{ zIndex: isSlam || isPahtnahCard ? 10 : index + 1 }}
              >
                <PlayingCard card={trickCard.card} small trumpSuit={trumpSuit} />
                {isSlam && <Catch5Effect onShake={onShake} cardId={trickCard.card.id} />}
                {isPahtnahCard && pahtnahActive && (
                  <PahtnahSlam
                    onShake={onPahtnahSlam}
                    onComplete={() => setPahtnahActive(false)}
                  />
                )}
              </motion.div>
            );
          });
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}

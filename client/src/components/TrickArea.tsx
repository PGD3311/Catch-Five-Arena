import { TrickCard, Player, Suit } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: Player[];
  trumpSuit?: Suit | null;
  mySeatIndex?: number;
}

export function TrickArea({ currentTrick, players, trumpSuit, mySeatIndex = 0 }: TrickAreaProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

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
                  scale: 1,
                  opacity: 1,
                  rotate: pos.rotate
                }}
                exit={{
                  scale: 0.4,
                  opacity: 0,
                  y: -40
                }}
                transition={{
                  type: "spring",
                  stiffness: 280,
                  damping: 24,
                  mass: 0.7
                }}
                className="absolute"
                style={{ zIndex: index + 1 }}
              >
                <PlayingCard card={trickCard.card} small trumpSuit={trumpSuit} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

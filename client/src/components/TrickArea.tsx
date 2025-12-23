import { TrickCard, Player, Suit } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: Player[];
  trumpSuit?: Suit | null;
}

export function TrickArea({ currentTrick, players, trumpSuit }: TrickAreaProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  
  const getPositionForPlayer = (playerId: string): { x: number; y: number; rotate: number } => {
    const playerIndex = players.findIndex(p => p.id === playerId);
    const scale = isMobile ? 0.65 : 1;
    switch (playerIndex) {
      case 0:
        return { x: 0, y: 70 * scale, rotate: 0 };
      case 1:
        return { x: -85 * scale, y: 0, rotate: -3 };
      case 2:
        return { x: 0, y: -70 * scale, rotate: 0 };
      case 3:
        return { x: 85 * scale, y: 0, rotate: 3 };
      default:
        return { x: 0, y: 0, rotate: 0 };
    }
  };

  const getStartPosition = (playerId: string): { x: number; y: number } => {
    const playerIndex = players.findIndex(p => p.id === playerId);
    switch (playerIndex) {
      case 0:
        return { x: 0, y: 150 };
      case 1:
        return { x: -150, y: 0 };
      case 2:
        return { x: 0, y: -150 };
      case 3:
        return { x: 150, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  };

  const getPlayerName = (playerId: string): string => {
    return players.find(p => p.id === playerId)?.name || '';
  };

  return (
    <div className="relative w-full h-32 sm:h-48 md:h-56" data-testid="trick-area">
      {/* Minimal table surface */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-40 h-24 sm:w-56 sm:h-36 md:w-72 md:h-44 rounded-xl bg-emerald-900/30 border border-emerald-500/20">
          <div className="absolute inset-0 rounded-xl bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.05)_0%,_transparent_70%)]" />
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
                  scale: 0.8, 
                  opacity: 0,
                  rotate: pos.rotate - 10
                }}
                animate={{ 
                  x: pos.x, 
                  y: pos.y, 
                  scale: 1, 
                  opacity: 1,
                  rotate: pos.rotate
                }}
                exit={{ 
                  scale: 0.5, 
                  opacity: 0,
                  y: -50
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 25,
                  mass: 0.8
                }}
                className="absolute"
                style={{ zIndex: index + 1 }}
              >
                <div className="relative">
                  <PlayingCard card={trickCard.card} small trumpSuit={trumpSuit} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

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
    console.log('[TrickArea] getVisualIndex:', { playerId, seatIndex, mySeatIndex, visualIndex: (seatIndex - mySeatIndex + 4) % 4, playerIds: players.map(p => p.id) });
    return (seatIndex - mySeatIndex + 4) % 4;
  };
  
  const getPositionForPlayer = (playerId: string): { x: number; y: number; rotate: number } => {
    const visualIndex = getVisualIndex(playerId);
    // Use larger offsets for clearer card positioning
    const xOffset = isMobile ? 45 : 75;
    const yOffset = isMobile ? 35 : 55;
    switch (visualIndex) {
      case 0: // Bottom (current player)
        return { x: 0, y: yOffset, rotate: 0 };
      case 1: // Left
        return { x: -xOffset, y: 0, rotate: -5 };
      case 2: // Top (partner)
        return { x: 0, y: -yOffset, rotate: 0 };
      case 3: // Right
        return { x: xOffset, y: 0, rotate: 5 };
      default:
        console.warn('[TrickArea] Unexpected visualIndex:', visualIndex, 'for player:', playerId);
        return { x: 0, y: 0, rotate: 0 };
    }
  };

  const getStartPosition = (playerId: string): { x: number; y: number } => {
    const visualIndex = getVisualIndex(playerId);
    switch (visualIndex) {
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
    <div className="relative w-full h-36 sm:h-48 md:h-56" data-testid="trick-area">
      {/* Minimal table surface - slightly larger on mobile */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-44 h-28 sm:w-56 sm:h-36 md:w-72 md:h-44 rounded-xl bg-emerald-900/30 border border-emerald-500/20">
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

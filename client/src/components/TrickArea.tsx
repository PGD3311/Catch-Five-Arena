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
  const getPositionForPlayer = (playerId: string): { x: number; y: number; rotate: number } => {
    const playerIndex = players.findIndex(p => p.id === playerId);
    switch (playerIndex) {
      case 0:
        return { x: 0, y: 70, rotate: 0 };
      case 1:
        return { x: -85, y: 0, rotate: -3 };
      case 2:
        return { x: 0, y: -70, rotate: 0 };
      case 3:
        return { x: 85, y: 0, rotate: 3 };
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
    <div className="relative w-full h-56 md:h-72" data-testid="trick-area">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-64 h-44 md:w-80 md:h-56 rounded-2xl bg-gradient-to-br from-emerald-800/40 to-emerald-900/60 border border-emerald-500/30 shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.1)_0%,_transparent_70%)]" />
          <div className="absolute inset-[2px] rounded-2xl border border-emerald-400/10" />
        </div>
      </div>

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
                  <div className="absolute -inset-2 bg-black/20 rounded-xl blur-md" />
                  <PlayingCard card={trickCard.card} small trumpSuit={trumpSuit} />
                  <motion.span
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={cn(
                      'absolute -bottom-6 left-1/2 -translate-x-1/2',
                      'text-xs font-semibold text-emerald-100/90 whitespace-nowrap',
                      'bg-emerald-900/80 px-2 py-0.5 rounded-full border border-emerald-500/30',
                      'shadow-lg'
                    )}
                  >
                    {getPlayerName(trickCard.playerId)}
                  </motion.span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {currentTrick.length === 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="text-sm text-emerald-300/60 font-medium" data-testid="text-trick-prompt">
            Play a card to start the trick
          </span>
        </motion.div>
      )}

    </div>
  );
}

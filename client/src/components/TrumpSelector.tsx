import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Suit, SUITS } from '@shared/gameTypes';
import { Heart, Diamond, Club, Spade } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '@/hooks/useSoundEffects';

interface TrumpSelectorProps {
  open: boolean;
  onSelect: (suit: Suit) => void;
}

const suitConfig = {
  Hearts: { Icon: Heart, color: 'text-red-500', glowColor: 'rgba(239, 68, 68, 0.4)' },
  Diamonds: { Icon: Diamond, color: 'text-blue-500', glowColor: 'rgba(59, 130, 246, 0.4)' },
  Clubs: { Icon: Club, color: 'text-emerald-600 dark:text-emerald-400', glowColor: 'rgba(16, 185, 129, 0.4)' },
  Spades: { Icon: Spade, color: 'text-slate-800 dark:text-slate-100', glowColor: 'rgba(148, 163, 184, 0.4)' },
};

const bgHoverConfig: Record<Suit, string> = {
  Hearts: 'hover:bg-red-50 dark:hover:bg-red-950/30',
  Diamonds: 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
  Clubs: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30',
  Spades: 'hover:bg-slate-100 dark:hover:bg-slate-800',
};

// Stable keyframe refs — prevent Framer Motion replays on re-render
const CHOSEN_SCALE: number[] = [1, 1.18, 1.08];

export function TrumpSelector({ open, onSelect }: TrumpSelectorProps) {
  const [chosenSuit, setChosenSuit] = useState<Suit | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { playSound } = useSound();

  // Reset ceremony state when dialog closes
  useEffect(() => {
    if (!open) {
      setChosenSuit(null);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSuitClick = useCallback((suit: Suit) => {
    if (chosenSuit) return; // Already declaring
    setChosenSuit(suit);
    playSound('trumpDeclare');

    // Hold the ceremony for 1.1s, then fire onSelect
    timerRef.current = setTimeout(() => {
      onSelect(suit);
    }, 1100);
  }, [chosenSuit, onSelect, playSound]);

  const isDeclaring = chosenSuit !== null;

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md top-[20%] translate-y-0"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Header — fades out during ceremony */}
        <AnimatePresence>
          {!isDeclaring && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <DialogHeader>
                <DialogTitle className="text-center text-2xl">Select Trump Suit</DialogTitle>
              </DialogHeader>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          'grid gap-4 py-6 transition-all duration-300',
          isDeclaring ? 'grid-cols-1 place-items-center' : 'grid-cols-2'
        )}>
          <AnimatePresence mode="popLayout">
            {SUITS.map((suit) => {
              const { Icon, color, glowColor } = suitConfig[suit];
              const isChosen = suit === chosenSuit;
              const isRejected = isDeclaring && !isChosen;

              if (isRejected) {
                return (
                  <motion.div
                    key={suit}
                    initial={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6, filter: 'blur(4px)' }}
                    transition={{ duration: 0.3, ease: 'easeIn' }}
                    layout
                  >
                    <Button
                      variant="outline"
                      disabled
                      className={cn(
                        'h-28 w-full flex flex-col items-center justify-center gap-2',
                        'border-2 transition-all pointer-events-none'
                      )}
                      data-testid={`button-trump-${suit.toLowerCase()}`}
                    >
                      <Icon className={cn('w-12 h-12', color)} fill="currentColor" />
                      <span className="text-lg font-semibold">{suit}</span>
                    </Button>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={suit}
                  layout
                  transition={{ layout: { type: 'spring', stiffness: 300, damping: 25 } }}
                >
                  <motion.div
                    animate={isChosen ? {
                      scale: CHOSEN_SCALE,
                    } : {}}
                    transition={isChosen ? {
                      scale: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                    } : {}}
                  >
                    <Button
                      variant="outline"
                      onClick={() => handleSuitClick(suit)}
                      className={cn(
                        'h-28 flex flex-col items-center justify-center gap-2',
                        !isDeclaring && bgHoverConfig[suit],
                        'border-2 transition-all',
                        isChosen && 'border-[var(--gold)]/50'
                      )}
                      style={isChosen ? {
                        boxShadow: `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
                        width: '14rem',
                      } : {}}
                      data-testid={`button-trump-${suit.toLowerCase()}`}
                    >
                      <motion.div
                        animate={isChosen ? { scale: [1, 1.3, 1.2] } : {}}
                        transition={isChosen ? { duration: 0.6, ease: [0.22, 1, 0.36, 1] } : {}}
                      >
                        <Icon className={cn(
                          isChosen ? 'w-16 h-16' : 'w-12 h-12',
                          color,
                          'transition-all duration-300'
                        )} fill="currentColor" />
                      </motion.div>
                      <motion.span
                        className={cn(
                          'font-semibold transition-all duration-300',
                          isChosen ? 'text-xl tracking-wide' : 'text-lg'
                        )}
                        animate={isChosen ? { opacity: [1, 0.6, 1] } : {}}
                        transition={isChosen ? { duration: 0.8, ease: 'easeInOut' } : {}}
                      >
                        {suit}
                      </motion.span>
                    </Button>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* "TRUMP" label fades in during ceremony */}
        <AnimatePresence>
          {isDeclaring && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
              className="text-center text-sm font-semibold tracking-[0.2em] uppercase text-muted-foreground -mt-2 pb-2"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Trump
            </motion.p>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

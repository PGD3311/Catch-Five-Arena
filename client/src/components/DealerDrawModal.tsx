import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Player, DealerDrawCard, RANK_ORDER_ACE_LOW, Card } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';
import { Crown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SUIT_ORDER: Record<string, number> = {
  'Clubs': 0,
  'Diamonds': 1,
  'Hearts': 2,
  'Spades': 3,
};

const getDealerDrawValue = (card: Card): number => {
  const rankValue = RANK_ORDER_ACE_LOW[card.rank];
  const suitValue = SUIT_ORDER[card.suit];
  return rankValue * 10 + suitValue;
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface DealerDrawModalProps {
  open: boolean;
  players: Player[];
  dealerDrawCards: DealerDrawCard[];
  onComplete: () => void;
  deckColor: string;
}

export function DealerDrawModal({ open, players, dealerDrawCards, onComplete, deckColor }: DealerDrawModalProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!open) {
      setRevealedCount(0);
      setShowResult(false);
      return;
    }

    if (revealedCount < 4) {
      const timer = setTimeout(() => {
        setRevealedCount(prev => prev + 1);
      }, 600);
      return () => clearTimeout(timer);
    } else if (!showResult) {
      const timer = setTimeout(() => {
        setShowResult(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [open, revealedCount, showResult]);

  let lowestIndex = 0;
  if (dealerDrawCards.length > 0) {
    let lowestValue = getDealerDrawValue(dealerDrawCards[0].card);
    for (let i = 1; i < dealerDrawCards.length; i++) {
      const cardValue = getDealerDrawValue(dealerDrawCards[i].card);
      if (cardValue < lowestValue) {
        lowestValue = cardValue;
        lowestIndex = i;
      }
    }
  }

  const dealerPlayer = players[lowestIndex];

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-lg border-[hsl(var(--gold-dim)/0.15)] bg-card/95 backdrop-blur-xl" onPointerDownOutside={(e) => e.preventDefault()}>
        {/* Header */}
        <div className="text-center space-y-2 pt-2 pb-4">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="text-2xl font-bold tracking-tight gold-text"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Drawing for Dealer
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground/50"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Low card deals first
          </motion.p>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT }}
            className="mx-auto w-20 h-px bg-gradient-to-r from-transparent via-[hsl(var(--gold)/0.4)] to-transparent"
          />
        </div>

        {/* Cards grid */}
        <div className="py-2 space-y-5">
          <div className="relative">
            <div className="absolute inset-2 rounded-xl felt-surface opacity-20 pointer-events-none" />
            <div className="relative grid grid-cols-2 gap-3 p-2">
              {players.map((player, index) => {
                const drawCard = dealerDrawCards[index];
                const isRevealed = index < revealedCount;
                const isDealer = showResult && index === lowestIndex;
                const isNotDealer = showResult && index !== lowestIndex;
                const teamSide = index % 2 === 0 ? 'blue' : 'red';

                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.08, duration: 0.35, ease: EASE_OUT }}
                    className={cn(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-500',
                      isDealer
                        ? 'bg-[hsl(var(--gold)/0.08)] border-[hsl(var(--gold)/0.3)] ring-2 ring-[hsl(var(--gold)/0.3)]'
                        : isNotDealer
                        ? 'bg-card/30 border-border/20 opacity-50'
                        : 'bg-card/50 border-border/30'
                    )}
                  >
                    {/* Player name */}
                    <div className="flex items-center gap-1.5">
                      <AnimatePresence>
                        {isDealer && (
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          >
                            <Crown className="w-4 h-4 text-[hsl(var(--gold))]" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <span
                        className={cn(
                          'font-semibold text-sm transition-colors duration-300',
                          isDealer ? 'text-[hsl(var(--gold))]' : `text-[hsl(var(--team-${teamSide}))]`
                        )}
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {player.name}
                      </span>
                    </div>

                    {/* Card reveal */}
                    <div className="relative">
                      <motion.div
                        animate={isRevealed ? { rotateY: 0 } : { rotateY: 180 }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                        style={{ perspective: 600 }}
                      >
                        {drawCard && (
                          <PlayingCard
                            card={isRevealed ? drawCard.card : undefined}
                            faceDown={!isRevealed}
                            deckColor={deckColor as any}
                            small
                          />
                        )}
                      </motion.div>

                      {/* Glow behind dealer's card */}
                      {isDealer && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.6 }}
                          className="absolute inset-0 -z-10 rounded-lg blur-xl bg-[hsl(var(--gold)/0.2)]"
                        />
                      )}
                    </div>

                    {/* Card label */}
                    <AnimatePresence>
                      {isRevealed && drawCard && (
                        <motion.span
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className={cn(
                            'text-xs tabular-nums',
                            isDealer ? 'text-[hsl(var(--gold))] font-semibold' : 'text-muted-foreground/60'
                          )}
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {drawCard.card.rank} of {drawCard.card.suit}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Result */}
          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="text-center space-y-4"
              >
                <p className="text-base" style={{ fontFamily: 'var(--font-display)' }}>
                  <span className="font-bold gold-text">{dealerPlayer?.name}</span>
                  <span className="text-muted-foreground/70"> draws lowest and will deal</span>
                </p>
                <Button
                  onClick={onComplete}
                  className="px-8 shadow-[0_0_24px_hsl(var(--gold)/0.12)] hover:shadow-[0_0_32px_hsl(var(--gold)/0.2)] transition-shadow"
                  style={{ fontFamily: 'var(--font-display)' }}
                  data-testid="button-start-dealing"
                >
                  Start Dealing
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

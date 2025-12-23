import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MIN_BID, MAX_BID } from '@shared/gameTypes';
import { Gavel, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BiddingPanelProps {
  open: boolean;
  highBid: number;
  playerName: string;
  isDealer: boolean;
  allOthersPassed: boolean;
  onBid: (bid: number) => void;
}

export function BiddingPanel({ open, highBid, playerName, isDealer, allOthersPassed, onBid }: BiddingPanelProps) {
  const bidOptions = Array.from({ length: MAX_BID - MIN_BID + 1 }, (_, i) => MIN_BID + i);
  const mustBid = isDealer && allOthersPassed;

  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50',
            'bg-gradient-to-t from-card via-card/98 to-card/95 backdrop-blur-lg border-t border-border/50',
            'shadow-[0_-8px_40px_rgba(0,0,0,0.4)]'
          )}
          data-testid="bidding-panel"
        >
          <div className="max-w-2xl mx-auto px-4 py-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -15, 15, 0] }}
                  transition={{ duration: 0.5 }}
                  className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center"
                >
                  <Gavel className="w-5 h-5 text-primary" />
                </motion.div>
                <div className="flex flex-col">
                  <span className="font-bold text-lg">Place Your Bid</span>
                  <span className="text-xs text-muted-foreground">Choose a number higher than the current bid</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {highBid > 0 && (
                  <div className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
                    <span className="text-sm text-muted-foreground">Current: </span>
                    <span className="font-bold text-lg text-foreground">{highBid}</span>
                  </div>
                )}
                
                {mustBid && (
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40"
                  >
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-400">Must bid!</span>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {bidOptions.map((bid, index) => {
                const isValid = bid > highBid;
                return (
                  <motion.div
                    key={bid}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Button
                      variant={isValid ? 'default' : 'secondary'}
                      size="lg"
                      disabled={!isValid}
                      onClick={() => onBid(bid)}
                      className={cn(
                        'h-14 w-14 text-xl font-bold rounded-xl',
                        isValid && 'shadow-lg',
                        !isValid && 'opacity-30'
                      )}
                      data-testid={`button-bid-${bid}`}
                    >
                      {bid}
                    </Button>
                  </motion.div>
                );
              })}

              {!mustBid && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => onBid(0)}
                    className="h-14 px-8 text-base font-semibold ml-2 rounded-xl"
                    data-testid="button-pass"
                  >
                    Pass
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

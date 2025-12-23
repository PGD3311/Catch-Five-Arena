import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MIN_BID, MAX_BID } from '@shared/gameTypes';
import { AlertCircle } from 'lucide-react';
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

  if (!open) return null;

  return (
    <>
      {/* Dim overlay for focus */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40 sm:hidden"
      />
      
      {/* Bottom sheet on mobile, inline on desktop */}
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 sm:relative sm:inset-auto',
          'bg-background/95 backdrop-blur-xl',
          'border-t border-border/50 sm:border sm:rounded-xl',
          'shadow-[0_-8px_32px_rgba(0,0,0,0.3)] sm:shadow-lg',
          'p-4 pb-6 sm:p-4'
        )}
        data-testid="bidding-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="font-semibold text-base sm:text-sm">Place Your Bid</span>
            {highBid > 0 && (
              <span className="text-sm sm:text-xs text-muted-foreground">Current high: {highBid}</span>
            )}
          </div>
          
          {mustBid && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">Must bid</span>
            </div>
          )}
        </div>

        {/* Bid buttons - larger and more breathable on mobile */}
        <div className="flex items-center gap-3 sm:gap-2 flex-wrap justify-center">
          {bidOptions.map((bid) => {
            const canDealerTakeNine = isDealer && highBid === MAX_BID && bid === MAX_BID;
            const isValid = bid > highBid || canDealerTakeNine;
            return (
              <Button
                key={bid}
                variant={isValid ? 'default' : 'secondary'}
                disabled={!isValid}
                onClick={() => onBid(bid)}
                className={cn(
                  'h-12 w-12 sm:h-10 sm:w-10 text-xl sm:text-lg font-bold rounded-xl sm:rounded-lg',
                  isValid && 'bg-emerald-600 hover:bg-emerald-500 text-white',
                  canDealerTakeNine && 'ring-2 ring-amber-400',
                  !isValid && 'opacity-25'
                )}
                data-testid={`button-bid-${bid}`}
              >
                {bid}
              </Button>
            );
          })}

          {!mustBid && (
            <Button
              variant="outline"
              onClick={() => onBid(0)}
              className="h-12 sm:h-10 px-8 sm:px-6 text-base sm:text-sm font-semibold rounded-xl sm:rounded-lg"
              data-testid="button-pass"
            >
              Pass
            </Button>
          )}
        </div>
      </motion.div>
    </>
  );
}

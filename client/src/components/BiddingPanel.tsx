import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MIN_BID, MAX_BID } from '@shared/gameTypes';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <motion.div 
      initial={{ y: 20, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        'bg-card/80 backdrop-blur-xl rounded-2xl border border-white/10',
        'shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-3'
      )}
      data-testid="bidding-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-col">
          <span className="font-semibold text-sm">Place Your Bid</span>
          {highBid > 0 && (
            <span className="text-xs text-muted-foreground">Current high: {highBid}</span>
          )}
        </div>
        
        {mustBid && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-medium text-amber-400">Must bid</span>
          </div>
        )}
      </div>

      {/* Bid buttons - larger touch targets on mobile */}
      <div className="flex items-center gap-2 sm:gap-2 flex-wrap justify-center">
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
                'h-12 w-12 sm:h-11 sm:w-11 text-xl sm:text-lg font-bold rounded-xl sm:rounded-lg',
                'active:scale-95 transition-transform',
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
            className="h-12 sm:h-11 px-6 sm:px-5 text-base sm:text-sm font-semibold rounded-xl sm:rounded-lg active:scale-95 transition-transform"
            data-testid="button-pass"
          >
            Pass
          </Button>
        )}
      </div>
    </motion.div>
  );
}

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
      initial={{ y: 16, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 16, opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        'bg-card/90 backdrop-blur-xl rounded-2xl',
        'border border-border/50',
        'shadow-[0_8px_40px_rgba(0,0,0,0.4)] p-3'
      )}
      data-testid="bidding-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-[hsl(var(--gold))]" style={{ fontFamily: 'var(--font-display)' }}>Place Your Bid</span>
          {highBid > 0 && (
            <span className="text-xs text-muted-foreground/60">Current high: {highBid}</span>
          )}
        </div>

        {mustBid && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[hsl(var(--gold)/0.1)] border border-[hsl(var(--gold)/0.25)]">
            <AlertCircle className="w-3 h-3 text-[hsl(var(--gold))]" />
            <span className="text-[10px] font-semibold text-[hsl(var(--gold))]">Must bid</span>
          </div>
        )}
      </div>

      {/* Bid buttons */}
      <div className="flex items-center gap-2 sm:gap-2 flex-wrap justify-center">
        {bidOptions.map((bid) => {
          const canDealerTakeNine = isDealer && highBid === MAX_BID && bid === MAX_BID;
          const isValid = bid > highBid || canDealerTakeNine;
          return (
            <button
              key={bid}
              disabled={!isValid}
              onClick={() => onBid(bid)}
              className={cn(
                'h-12 w-12 sm:h-11 sm:w-11 rounded-xl sm:rounded-lg',
                'text-xl sm:text-lg font-bold',
                'transition-all duration-150',
                'active:scale-95',
                isValid && 'bg-[hsl(var(--felt-glow))] hover:bg-[hsl(150_45%_30%)] text-white shadow-md',
                isValid && 'hover:shadow-lg hover:shadow-[hsl(var(--felt-glow)/0.2)]',
                canDealerTakeNine && 'ring-2 ring-[hsl(var(--gold))] shadow-[0_0_12px_hsl(var(--gold)/0.2)]',
                !isValid && 'bg-muted/30 text-muted-foreground/20 cursor-not-allowed'
              )}
              style={{ fontFamily: 'var(--font-display)' }}
              data-testid={`button-bid-${bid}`}
            >
              {bid}
            </button>
          );
        })}

        {!mustBid && (
          <Button
            variant="outline"
            onClick={() => onBid(0)}
            className="h-12 sm:h-11 px-6 sm:px-5 text-base sm:text-sm font-semibold rounded-xl active:scale-95 transition-all border-border/50"
            style={{ fontFamily: 'var(--font-display)' }}
            data-testid="button-pass"
          >
            Pass
          </Button>
        )}
      </div>
    </motion.div>
  );
}

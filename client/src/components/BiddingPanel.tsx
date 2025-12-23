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

  if (!open) return null;

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 20, opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        'bg-card/95 backdrop-blur-md rounded-xl border border-border/60',
        'shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4'
      )}
      data-testid="bidding-panel"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Gavel className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">Place Your Bid</span>
          {highBid > 0 && (
            <span className="text-xs text-muted-foreground">Current high: {highBid}</span>
          )}
        </div>
        
        {mustBid && (
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 ml-auto"
          >
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">Must bid</span>
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        {bidOptions.map((bid, index) => {
          const isValid = bid > highBid;
          return (
            <motion.div
              key={bid}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
            >
              <Button
                variant={isValid ? 'default' : 'secondary'}
                disabled={!isValid}
                onClick={() => onBid(bid)}
                className={cn(
                  'h-11 w-11 text-lg font-bold rounded-lg',
                  isValid && 'bg-emerald-600 hover:bg-emerald-500 text-white',
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
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              variant="outline"
              onClick={() => onBid(0)}
              className="h-11 px-6 text-sm font-semibold rounded-lg"
              data-testid="button-pass"
            >
              Pass
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

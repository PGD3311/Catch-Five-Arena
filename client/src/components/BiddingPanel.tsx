import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MIN_BID, MAX_BID } from '@shared/gameTypes';
import { Gavel } from 'lucide-react';

interface BiddingPanelProps {
  open: boolean;
  highBid: number;
  playerName: string;
  isDealer: boolean;
  allOthersPassed: boolean;
  onBid: (bid: number) => void;
}

export function BiddingPanel({ open, highBid, playerName, isDealer, allOthersPassed, onBid }: BiddingPanelProps) {
  if (!open) return null;

  const bidOptions = Array.from({ length: MAX_BID - MIN_BID + 1 }, (_, i) => MIN_BID + i);
  const mustBid = isDealer && allOthersPassed;

  return (
    <div 
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-card/95 backdrop-blur-md border-t border-border',
        'shadow-[0_-8px_32px_rgba(0,0,0,0.3)]',
        'animate-in slide-in-from-bottom duration-300'
      )}
      data-testid="bidding-panel"
    >
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-primary" />
            <span className="font-semibold">Your Bid</span>
          </div>
          
          <div className="flex items-center gap-3">
            {highBid > 0 && (
              <span className="text-sm text-muted-foreground">
                Beat: <span className="font-bold text-foreground">{highBid}</span>
              </span>
            )}
            
            {mustBid && (
              <span className="text-sm font-medium text-amber-500">
                Must bid!
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {bidOptions.map((bid) => {
            const isValid = bid > highBid;
            return (
              <Button
                key={bid}
                variant={isValid ? 'default' : 'secondary'}
                size="lg"
                disabled={!isValid}
                onClick={() => onBid(bid)}
                className={cn(
                  'h-12 w-12 text-lg font-bold',
                  !isValid && 'opacity-30'
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
              size="lg"
              onClick={() => onBid(0)}
              className="h-12 px-6 text-base ml-2"
              data-testid="button-pass"
            >
              Pass
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

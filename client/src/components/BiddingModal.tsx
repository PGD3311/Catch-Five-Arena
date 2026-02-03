import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MIN_BID, MAX_BID } from '@shared/gameTypes';

interface BiddingModalProps {
  open: boolean;
  highBid: number;
  playerName: string;
  isDealer: boolean;
  allOthersPassed: boolean;
  onBid: (bid: number) => void;
}

export function BiddingModal({ open, highBid, playerName, isDealer, allOthersPassed, onBid }: BiddingModalProps) {
  const bidOptions = Array.from({ length: MAX_BID - MIN_BID + 1 }, (_, i) => MIN_BID + i);
  const validBids = bidOptions.filter(b => b > highBid);
  const mustBid = isDealer && allOthersPassed;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Your Bid, {playerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {highBid > 0 && (
            <p className="text-center text-muted-foreground">
              Current high bid: <span className="font-bold text-foreground">{highBid}</span>
            </p>
          )}

          {mustBid && (
            <div className="px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-center">
              <p className="text-sm font-medium">Everyone passed - you must bid {MIN_BID}!</p>
            </div>
          )}

          <div className="grid grid-cols-5 gap-3">
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
                    'h-14 text-xl font-bold rounded-xl',
                    !isValid && 'opacity-40'
                  )}
                  data-testid={`button-bid-${bid}`}
                >
                  {bid}
                </Button>
              );
            })}
          </div>

          {!mustBid && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => onBid(0)}
              className="w-full h-12 text-lg rounded-xl"
              data-testid="button-pass"
            >
              Pass
            </Button>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Bid on how many of the 9 points your team will catch (High, Low, Jack, Five=5, Game)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

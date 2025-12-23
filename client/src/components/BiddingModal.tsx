import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BiddingModalProps {
  open: boolean;
  highBid: number;
  playerName: string;
  onBid: (bid: number) => void;
}

export function BiddingModal({ open, highBid, playerName, onBid }: BiddingModalProps) {
  const bidOptions = [2, 3, 4, 5, 6, 7, 8, 9];
  const validBids = bidOptions.filter(b => b > highBid);

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

          <div className="grid grid-cols-4 gap-3">
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
                    'h-14 text-xl font-bold',
                    !isValid && 'opacity-40'
                  )}
                  data-testid={`button-bid-${bid}`}
                >
                  {bid}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="lg"
            onClick={() => onBid(0)}
            className="w-full h-12 text-lg"
            data-testid="button-pass"
          >
            Pass
          </Button>

          {validBids.length === 0 && highBid > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              No valid bids available. You must pass.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export function RulesModal({ open, onClose }: RulesModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">How to Play Catch 5</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6 text-sm leading-relaxed">
            <section>
              <h3 className="text-lg font-semibold mb-2">Overview</h3>
              <p className="text-muted-foreground">
                Catch 5 is a 2v2 trick-taking card game. You and your Partner play against 
                two Opponents. First team to 31 points wins!
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">The Deal</h3>
              <p className="text-muted-foreground">
                Each player receives 9 cards. The remaining cards form the stock pile.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Bidding (5-9)</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Bid on how many of the 9 points your team will catch</li>
                <li>Bids must be between 5 and 9</li>
                <li>If everyone passes, the dealer must bid 5</li>
                <li>The highest bidder names trump and leads first</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">The Purge & Draw</h3>
              <p className="text-muted-foreground mb-2">
                After trump is named:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>You must discard ALL non-trump cards from your hand</li>
                <li>If you have 9+ trumps, discard your lowest 3 trumps</li>
                <li>Draw from the stock until you have exactly 6 cards</li>
                <li>Cards drawn now are kept even if not trump</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Playing Tricks</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>The bidder leads the first card</li>
                <li>You must follow suit if possible</li>
                <li>If you cannot follow suit, play any card (trump to win)</li>
                <li>Highest trump wins, or highest card of led suit</li>
                <li>The trick winner leads the next trick</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Scoring (9 Points Total)</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>High (1 point):</strong> Winning the highest trump played</li>
                <li><strong>Low (1 point):</strong> Winning the lowest trump played</li>
                <li><strong>Jack (1 point):</strong> Winning the Jack of trump</li>
                <li><strong>Five (5 points):</strong> Catching the 5 of trump!</li>
                <li><strong>Game (1 point):</strong> Highest card point total (10=10, A=4, K=3, Q=2, J=1)</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Results</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Made it:</strong> Bidding team scores what they caught</li>
                <li><strong>Set:</strong> Bidding team loses their bid amount</li>
                <li>Opponents always score what they caught</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Winning</h3>
              <p className="text-muted-foreground">
                First team to reach 31 points wins the game!
              </p>
            </section>
          </div>
        </ScrollArea>

        <div className="pt-4">
          <Button onClick={onClose} className="w-full" data-testid="button-close-rules">
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

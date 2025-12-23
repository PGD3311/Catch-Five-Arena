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
                Catch 5 (also known as Pitch or Setback) is a trick-taking card game for 4 players.
                The goal is to be the first to reach 21 points by winning tricks and capturing
                valuable trump cards.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Dealing</h3>
              <p className="text-muted-foreground">
                Each player receives 6 cards at the start of each round.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Bidding</h3>
              <p className="text-muted-foreground">
                Players bid on how many points they think they can win (2-9).
                The highest bidder chooses the trump suit and leads the first trick.
                If you can't beat the current bid, you must pass.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Playing Tricks</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>The lead player plays any card</li>
                <li>Other players must follow suit if possible</li>
                <li>If you can't follow suit, you may play any card (including trump)</li>
                <li>The highest trump wins, or the highest card of the led suit</li>
                <li>The trick winner leads the next trick</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Scoring Points</h3>
              <p className="text-muted-foreground mb-2">
                At the end of each round, points are awarded for:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>High (1 point):</strong> Winning the highest trump played</li>
                <li><strong>Low (1 point):</strong> Winning the lowest trump played</li>
                <li><strong>Jack (1 point):</strong> Winning the Jack of trump</li>
                <li><strong>Game (1 point):</strong> Having the highest total card points (10=10, A=4, K=3, Q=2, J=1)</li>
                <li><strong>Five (5 points):</strong> Catching the 5 of trump!</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Going Set</h3>
              <p className="text-muted-foreground">
                If the bidder fails to make their bid, they "go set" and lose points equal to their bid.
                Other players keep any points they earned.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2">Winning</h3>
              <p className="text-muted-foreground">
                The first player to reach 21 points wins the game!
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

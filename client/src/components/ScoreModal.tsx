import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Player } from '@shared/gameTypes';
import { cn } from '@/lib/utils';
import { Trophy, TrendingDown, TrendingUp } from 'lucide-react';

interface ScoreModalProps {
  open: boolean;
  players: Player[];
  roundScores: Record<string, number>;
  bidderId: string | null;
  highBid: number;
  onContinue: () => void;
  isGameOver?: boolean;
}

export function ScoreModal({
  open,
  players,
  roundScores,
  bidderId,
  highBid,
  onContinue,
  isGameOver = false,
}: ScoreModalProps) {
  const bidder = players.find(p => p.id === bidderId);
  const bidderScore = bidder ? roundScores[bidder.id] || 0 : 0;
  const bidderMadeIt = bidderScore >= highBid;

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = isGameOver ? sortedPlayers[0] : null;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl flex items-center justify-center gap-2">
            {isGameOver ? (
              <>
                <Trophy className="w-6 h-6 text-amber-500" />
                Game Over!
              </>
            ) : (
              'Round Complete'
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {bidder && (
            <div
              className={cn(
                'p-4 rounded-lg text-center',
                bidderMadeIt
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
              )}
              data-testid="display-bidder-result"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                {bidderMadeIt ? (
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                <span className="font-bold text-lg" data-testid="text-bidder-outcome">
                  {bidder.name} {bidderMadeIt ? 'made it!' : 'went set!'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-bid-summary">
                Bid: {highBid} | Scored: {bidderScore}
                {!bidderMadeIt && ` | Penalty: -${highBid}`}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">
              {isGameOver ? 'Final Standings' : 'Round Scores'}
            </h3>
            <div className="space-y-2">
              {sortedPlayers.map((player, index) => {
                const roundScore = roundScores[player.id] || 0;
                const isBidder = player.id === bidderId;
                const displayRoundScore = isBidder && roundScore < highBid ? -highBid : roundScore;

                return (
                  <div
                    key={player.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg',
                      'bg-muted/50',
                      isGameOver && index === 0 && 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-400'
                    )}
                    data-testid={`score-row-${player.id}`}
                  >
                    <div className="flex items-center gap-3">
                      {isGameOver && index === 0 && (
                        <Trophy className="w-5 h-5 text-amber-500" />
                      )}
                      <span className="font-medium">{player.name}</span>
                      {isBidder && (
                        <Badge variant="secondary" className="text-xs">
                          Bidder
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {!isGameOver && (
                        <span
                          className={cn(
                            'text-sm font-medium',
                            displayRoundScore > 0 && 'text-emerald-600 dark:text-emerald-400',
                            displayRoundScore < 0 && 'text-red-600 dark:text-red-400'
                          )}
                        >
                          {displayRoundScore > 0 ? '+' : ''}{displayRoundScore}
                        </span>
                      )}
                      <span className="text-xl font-bold">{player.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onContinue}
            className="w-full"
            size="lg"
            data-testid="button-continue"
          >
            {isGameOver ? 'New Game' : 'Continue to Next Round'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Team, Player } from '@shared/gameTypes';
import { cn } from '@/lib/utils';
import { Trophy, TrendingDown, TrendingUp, Users } from 'lucide-react';

interface ScoreModalProps {
  open: boolean;
  teams: Team[];
  players: Player[];
  roundScores: Record<string, number>;
  bidderId: string | null;
  highBid: number;
  onContinue: () => void;
  isGameOver?: boolean;
  targetScore: number;
}

export function ScoreModal({
  open,
  teams,
  players,
  roundScores,
  bidderId,
  highBid,
  onContinue,
  isGameOver = false,
  targetScore,
}: ScoreModalProps) {
  const bidder = players.find(p => p.id === bidderId);
  const bidderTeam = teams.find(t => t.id === bidder?.teamId);
  const bidderTeamScore = bidderTeam ? roundScores[bidderTeam.id] || 0 : 0;
  const bidderMadeIt = bidderTeamScore >= highBid;

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const winningTeam = isGameOver ? sortedTeams[0] : null;
  const isYourTeamWinning = winningTeam?.id === 'team1';

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl flex items-center justify-center gap-2">
            {isGameOver ? (
              <>
                <Trophy className="w-6 h-6 text-amber-500" />
                {isYourTeamWinning ? 'You Won!' : 'Game Over'}
              </>
            ) : (
              'Round Complete'
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {bidderTeam && (
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
                  {bidderTeam.name} {bidderMadeIt ? 'made it!' : 'went set!'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-bid-summary">
                {bidder?.name} bid {highBid} | Team scored: {bidderTeamScore}
                {!bidderMadeIt && ` | Penalty: -${highBid}`}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">
              {isGameOver ? 'Final Standings' : 'Team Scores'}
            </h3>
            <div className="space-y-2">
              {sortedTeams.map((team, index) => {
                const roundScore = roundScores[team.id] || 0;
                const isBidderTeam = team.id === bidderTeam?.id;
                const displayRoundScore = isBidderTeam && roundScore < highBid ? -highBid : roundScore;
                const teamPlayers = players.filter(p => p.teamId === team.id);

                return (
                  <div
                    key={team.id}
                    className={cn(
                      'flex items-center justify-between p-4 rounded-lg',
                      'bg-muted/50',
                      isGameOver && index === 0 && 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-400'
                    )}
                    data-testid={`score-row-${team.id}`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {isGameOver && index === 0 && (
                          <Trophy className="w-5 h-5 text-amber-500" />
                        )}
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{team.name}</span>
                        {isBidderTeam && (
                          <Badge variant="secondary" className="text-xs">
                            Bidder
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {teamPlayers.map(p => p.name).join(' & ')}
                      </span>
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
                      <div className="text-right">
                        <span className="text-2xl font-bold">{team.score}</span>
                        <span className="text-xs text-muted-foreground">/{targetScore}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <p className="text-xs text-muted-foreground">
              Points this round: High (1) + Low (1) + Jack (1) + Five (5) + Game (1) = 9 total
            </p>
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

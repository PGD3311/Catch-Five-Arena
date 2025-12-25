import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Team, Player, RoundScoreDetails } from '@shared/gameTypes';
import { cn } from '@/lib/utils';
import { Trophy, TrendingDown, TrendingUp, Users, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const Confetti = ({ count = 50 }: { count?: number }) => {
  const colors = ['#fbbf24', '#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f97316'];
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: Math.random() * 400 - 200,
            y: -20,
            rotate: 0,
            opacity: 1
          }}
          animate={{ 
            y: 500,
            rotate: Math.random() * 720 - 360,
            opacity: 0
          }}
          transition={{ 
            duration: 2 + Math.random() * 2,
            delay: Math.random() * 0.5,
            ease: "easeOut"
          }}
          className="absolute top-0 left-1/2"
          style={{
            width: 8 + Math.random() * 8,
            height: 8 + Math.random() * 8,
            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
};

interface ScoreModalProps {
  open: boolean;
  teams: Team[];
  players: Player[];
  roundScores: Record<string, number>;
  roundScoreDetails?: RoundScoreDetails | null;
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
  roundScoreDetails,
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        {isGameOver && isYourTeamWinning && <Confetti count={60} />}
        
        <DialogHeader className="relative">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <DialogTitle className="text-center text-2xl flex items-center justify-center gap-3">
              {isGameOver ? (
                <>
                  <motion.div
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    <Trophy className="w-8 h-8 text-amber-500 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                  </motion.div>
                  <span className={isYourTeamWinning ? 'text-amber-400' : ''}>
                    {isYourTeamWinning ? 'Victory!' : 'Game Over'}
                  </span>
                  {isYourTeamWinning && (
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                    >
                      <Sparkles className="w-6 h-6 text-amber-400" />
                    </motion.div>
                  )}
                </>
              ) : (
                'Round Complete'
              )}
            </DialogTitle>
          </motion.div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {bidderTeam && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'p-4 rounded-xl text-center',
                bidderMadeIt
                  ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/40'
                  : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/40'
              )}
              data-testid="display-bidder-result"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                {bidderMadeIt ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span className="font-bold text-lg" data-testid="text-bidder-outcome">
                  {bidderTeam.name} {bidderMadeIt ? 'made it!' : 'went set!'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground" data-testid="text-bid-summary">
                {bidder?.name} bid {highBid} | Team scored: {bidderTeamScore}
                {!bidderMadeIt && ` | Penalty: -${highBid}`}
              </p>
            </motion.div>
          )}

          {/* Point Categories - High, Low, Jack, Five, Game */}
          {roundScoreDetails && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg text-center">Points Won</h3>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: 'high', label: 'High', points: 1 },
                  { key: 'low', label: 'Low', points: 1 },
                  { key: 'jack', label: 'Jack', points: 1 },
                  { key: 'five', label: 'Five', points: 5 },
                  { key: 'game', label: 'Game', points: 1 },
                ].map(({ key, label, points }) => {
                  const winner = roundScoreDetails[key as keyof RoundScoreDetails] as { teamId: string; card?: any; points?: number } | null;
                  const winningTeam = winner ? teams.find(t => t.id === winner.teamId) : null;
                  const isTeam1 = winningTeam?.id === 'team1';
                  
                  return (
                    <div
                      key={key}
                      className={cn(
                        'flex flex-col items-center p-3 rounded-lg border',
                        winner 
                          ? isTeam1 
                            ? 'bg-blue-500/20 border-blue-500/50' 
                            : 'bg-orange-500/20 border-orange-500/50'
                          : 'bg-muted/30 border-border/50'
                      )}
                      data-testid={`point-category-${key}`}
                    >
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
                      <span className={cn(
                        'text-lg font-bold',
                        winner 
                          ? isTeam1 
                            ? 'text-blue-400' 
                            : 'text-orange-400'
                          : 'text-muted-foreground'
                      )}>
                        {winner ? `+${points}` : '-'}
                      </span>
                      {winningTeam && (
                        <span className="text-xs text-muted-foreground truncate max-w-full">
                          {winningTeam.name.replace('Team ', 'T')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Game Point Breakdown */}
              {roundScoreDetails.gameBreakdown && (
                <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                  <h4 className="text-sm font-medium text-center mb-2">Game Point Breakdown</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {teams.map((team) => {
                      const breakdown = roundScoreDetails.gameBreakdown[team.id];
                      const isTeam1 = team.id === 'team1';
                      const isWinner = roundScoreDetails.game?.teamId === team.id;
                      
                      const formatBreakdown = () => {
                        const parts: string[] = [];
                        if (breakdown.aces > 0) parts.push(`${breakdown.aces} A`);
                        if (breakdown.kings > 0) parts.push(`${breakdown.kings} K`);
                        if (breakdown.queens > 0) parts.push(`${breakdown.queens} Q`);
                        if (breakdown.jacks > 0) parts.push(`${breakdown.jacks} J`);
                        if (breakdown.tens > 0) parts.push(`${breakdown.tens} 10`);
                        return parts.length > 0 ? parts.join(', ') : 'None';
                      };
                      
                      return (
                        <div
                          key={team.id}
                          className={cn(
                            'p-2 rounded-md text-center',
                            isWinner 
                              ? isTeam1 
                                ? 'bg-blue-500/20 ring-1 ring-blue-500/50' 
                                : 'bg-orange-500/20 ring-1 ring-orange-500/50'
                              : 'bg-muted/20'
                          )}
                          data-testid={`game-breakdown-${team.id}`}
                        >
                          <div className={cn(
                            'text-xs font-medium mb-1',
                            isTeam1 ? 'text-blue-400' : 'text-orange-400'
                          )}>
                            {team.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatBreakdown()}
                          </div>
                          <div className={cn(
                            'text-sm font-bold mt-1',
                            isWinner && (isTeam1 ? 'text-blue-400' : 'text-orange-400')
                          )}>
                            = {breakdown.total} pts
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!roundScoreDetails.game && (
                    <div className="text-xs text-center text-muted-foreground mt-2">
                      Tie - no Game point awarded
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">
              {isGameOver ? 'Final Standings' : 'Team Totals'}
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
                      'w-full flex items-center justify-between p-4 rounded-lg',
                      'bg-muted/50',
                      isGameOver && index === 0 && 'bg-amber-100 dark:bg-amber-900/30 ring-2 ring-amber-400'
                    )}
                    data-testid={`score-row-${team.id}`}
                  >
                    <div className="flex flex-col gap-1 text-left">
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
                    <div className="flex items-center gap-3">
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

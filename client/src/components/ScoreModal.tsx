import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Team, Player, RoundScoreDetails, Card, SUITS } from '@shared/gameTypes';
import { cn } from '@/lib/utils';
import { Trophy, TrendingDown, TrendingUp, Users, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const CONFETTI_COLORS = [
  'hsl(42, 82%, 58%)',   // gold
  'hsl(42, 90%, 72%)',   // light gold
  'hsl(215, 80%, 60%)',  // team-blue
  'hsl(355, 75%, 58%)',  // team-red
  'hsl(38, 70%, 50%)',   // dark gold
];

const Confetti = ({ count = 50 }: { count?: number }) => {
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
            backgroundColor: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
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
  sleptCards?: Card[];
  trumpSuit?: string | null;
  localTeamId?: string;
}

const suitSymbol: Record<string, string> = {
  Hearts: '\u2665',
  Diamonds: '\u2666',
  Clubs: '\u2663',
  Spades: '\u2660',
};

const suitColor: Record<string, string> = {
  Hearts: 'text-red-500',
  Diamonds: 'text-blue-500',
  Clubs: 'text-emerald-500',
  Spades: 'text-foreground',
};

const GoldDivider = () => (
  <motion.div
    initial={{ scaleX: 0, opacity: 0 }}
    animate={{ scaleX: 1, opacity: 1 }}
    transition={{ delay: 0.2, duration: 0.5 }}
    className="mx-auto mt-2 h-px w-3/4"
    style={{
      background: 'linear-gradient(90deg, transparent, hsl(42 82% 58% / 0.5), hsl(42 90% 72% / 0.7), hsl(42 82% 58% / 0.5), transparent)',
    }}
  />
);

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
  sleptCards = [],
  trumpSuit,
  localTeamId = 'team1',
}: ScoreModalProps) {
  const [canContinue, setCanContinue] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (open) {
      setCanContinue(false);
      setCountdown(5);

      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setCanContinue(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [open]);

  const bidder = players.find(p => p.id === bidderId);
  const bidderTeam = teams.find(t => t.id === bidder?.teamId);
  const bidderTeamScore = bidderTeam ? roundScores[bidderTeam.id] || 0 : 0;
  const bidderMadeIt = bidderTeamScore >= highBid;
  const isBidderYourTeam = bidderTeam?.id === localTeamId;
  // Good for you = your team made it OR opponents got set
  const isGoodForYou = isBidderYourTeam ? bidderMadeIt : !bidderMadeIt;

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  const winningTeam = isGameOver ? sortedTeams[0] : null;
  const isYourTeamWinning = winningTeam?.id === localTeamId;

  // Team-contextual message for bid outcome
  const getBidOutcomeMessage = () => {
    if (isBidderYourTeam) {
      return bidderMadeIt
        ? 'Your team made the bid!'
        : 'Your team was SET!';
    } else {
      return bidderMadeIt
        ? 'Opponents made their bid'
        : 'Opponents were SET!';
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="w-[95vw] sm:max-w-xl max-h-[85vh] overflow-y-auto mx-auto border-[hsl(var(--gold-dim)/0.15)] bg-card/95 backdrop-blur-xl [&>button:last-child]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
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
                  {isYourTeamWinning && (
                    <motion.div
                      animate={{ rotate: [0, -10, 10, 0] }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <Trophy className="w-8 h-8 text-[hsl(var(--gold))] drop-shadow-[0_0_8px_hsl(var(--gold)/0.5)]" />
                    </motion.div>
                  )}
                  <span
                    className={isYourTeamWinning ? 'gold-text' : 'text-red-400/80'}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {isYourTeamWinning ? 'Victory!' : 'Defeat'}
                  </span>
                  {isYourTeamWinning && (
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                    >
                      <Sparkles className="w-6 h-6 text-[hsl(var(--gold))]" />
                    </motion.div>
                  )}
                </>
              ) : (
                <span className="gold-text" style={{ fontFamily: 'var(--font-display)' }}>
                  Round Complete
                </span>
              )}
            </DialogTitle>
          </motion.div>
          <GoldDivider />
        </DialogHeader>

        <div className="space-y-4 py-2">
          {bidderTeam && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'p-3 rounded-xl text-center',
                isGoodForYou
                  ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/40'
                  : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/40'
              )}
              data-testid="display-bidder-result"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                {isGoodForYou ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
                <span className="font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }} data-testid="text-bidder-outcome">
                  {getBidOutcomeMessage()}
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
            <div className="space-y-2">
              <h3 className="font-semibold text-base text-center" style={{ fontFamily: 'var(--font-display)' }}>Points Won</h3>
              <div className="grid grid-cols-5 gap-1.5 p-2 rounded-xl felt-surface noise-overlay">
                {[
                  { key: 'high', label: 'High', points: 1 },
                  { key: 'low', label: 'Low', points: 1 },
                  { key: 'jack', label: 'Jack', points: 1 },
                  { key: 'five', label: 'Five', points: 5 },
                  { key: 'game', label: 'Game', points: 1 },
                ].map(({ key, label, points }, index) => {
                  const winner = roundScoreDetails[key as keyof RoundScoreDetails] as { teamId: string; card?: Card; points?: number } | null;
                  const winningTeam = winner ? teams.find(t => t.id === winner.teamId) : null;
                  const isTeam1 = winningTeam?.id === 'team1';
                  const winningCard = winner?.card;

                  return (
                    <motion.div
                      key={key}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15 + index * 0.08, type: "spring", stiffness: 400 }}
                      className={cn(
                        'flex flex-col items-center p-2 rounded-lg border min-h-[72px] justify-between',
                        winner
                          ? isTeam1
                            ? 'bg-[hsl(var(--team-blue)/0.2)] border-[hsl(var(--team-blue)/0.5)]'
                            : 'bg-[hsl(var(--team-red)/0.2)] border-[hsl(var(--team-red)/0.5)]'
                          : 'bg-muted/30 border-border/50'
                      )}
                      data-testid={`point-category-${key}`}
                    >
                      <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium" style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
                      {winningCard && key !== 'game' ? (
                        <div className="flex items-center gap-0.5">
                          <span className={cn("text-base font-bold", suitColor[winningCard.suit])}>
                            {winningCard.rank}
                          </span>
                          <span className={cn("text-sm", suitColor[winningCard.suit])}>
                            {suitSymbol[winningCard.suit]}
                          </span>
                        </div>
                      ) : (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.3 + index * 0.08, type: "spring", stiffness: 500 }}
                          className={cn(
                            'text-lg font-bold',
                            winner
                              ? isTeam1
                                ? 'text-[hsl(var(--team-blue))]'
                                : 'text-[hsl(var(--team-red))]'
                              : 'text-muted-foreground'
                          )}
                        >
                          {winner ? `+${points}` : '-'}
                        </motion.span>
                      )}
                      {winningTeam && (
                        <span className={cn(
                          "text-xs font-medium",
                          isTeam1 ? 'text-[hsl(var(--team-blue))]' : 'text-[hsl(var(--team-red))]'
                        )}>
                          {isTeam1 ? 'You' : 'Opp'}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Game Point Breakdown */}
              {roundScoreDetails.gameBreakdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-3 p-3 rounded-xl bg-muted/30 border border-border/50"
                >
                  <h4 className="text-xs font-semibold text-center mb-2 text-muted-foreground uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Game Point Breakdown</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {teams.map((team) => {
                      const breakdown = roundScoreDetails.gameBreakdown[team.id];
                      const isTeam1 = team.id === 'team1';
                      const isWinner = roundScoreDetails.game?.teamId === team.id;

                      const formatBreakdown = () => {
                        const parts: string[] = [];
                        if (breakdown.aces > 0) parts.push(`${breakdown.aces} Ace${breakdown.aces > 1 ? 's' : ''}`);
                        if (breakdown.kings > 0) parts.push(`${breakdown.kings} King${breakdown.kings > 1 ? 's' : ''}`);
                        if (breakdown.queens > 0) parts.push(`${breakdown.queens} Queen${breakdown.queens > 1 ? 's' : ''}`);
                        if (breakdown.jacks > 0) parts.push(`${breakdown.jacks} Jack${breakdown.jacks > 1 ? 's' : ''}`);
                        if (breakdown.tens > 0) parts.push(`${breakdown.tens} Ten${breakdown.tens > 1 ? 's' : ''}`);
                        return parts.length > 0 ? parts.join(', ') : 'None';
                      };

                      return (
                        <div
                          key={team.id}
                          className={cn(
                            'p-2 rounded-lg text-center',
                            isWinner
                              ? isTeam1
                                ? 'bg-[hsl(var(--team-blue)/0.2)] ring-1 ring-[hsl(var(--team-blue)/0.5)]'
                                : 'bg-[hsl(var(--team-red)/0.2)] ring-1 ring-[hsl(var(--team-red)/0.5)]'
                              : 'bg-muted/20'
                          )}
                          data-testid={`game-breakdown-${team.id}`}
                        >
                          <div className={cn(
                            'text-xs font-semibold mb-1',
                            isTeam1 ? 'text-[hsl(var(--team-blue))]' : 'text-[hsl(var(--team-red))]'
                          )} style={{ fontFamily: 'var(--font-display)' }}>
                            {isTeam1 ? 'Your Team' : 'Opponents'}
                          </div>
                          <div className="text-xs text-muted-foreground leading-relaxed">
                            {formatBreakdown()}
                          </div>
                          <div className={cn(
                            'text-sm font-bold mt-1',
                            isWinner && (isTeam1 ? 'text-[hsl(var(--team-blue))]' : 'text-[hsl(var(--team-red))]')
                          )}>
                            = {breakdown.total} pts
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!roundScoreDetails.game && (
                    <div className="text-xs text-center text-muted-foreground mt-2 italic">
                      Tie - no Game point awarded
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )}

          {/* Slept Cards */}
          {sleptCards.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="space-y-1"
            >
              <h3 className="font-medium text-xs text-muted-foreground">
                Slept Cards ({sleptCards.length})
              </h3>
              <div className="flex flex-wrap gap-1.5 p-1.5 rounded-lg bg-muted/30 border border-border/50">
                {SUITS.map(suit => {
                  const cardsOfSuit = sleptCards.filter(c => c.suit === suit);
                  if (cardsOfSuit.length === 0) return null;
                  const isTrump = suit === trumpSuit;
                  return (
                    <div key={suit} className={cn(
                      "flex items-center gap-0.5 px-1.5 py-0.5 rounded",
                      isTrump && "bg-amber-500/20 ring-1 ring-amber-500/50"
                    )}>
                      <span className={cn("text-sm", suitColor[suit])}>
                        {suitSymbol[suit]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {cardsOfSuit.map(c => c.rank).join(', ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold text-base" style={{ fontFamily: 'var(--font-display)' }}>
              {isGameOver ? 'Final Standings' : 'Team Totals'}
            </h3>
            <div className="space-y-1.5">
              {sortedTeams.map((team, index) => {
                const roundScore = roundScores[team.id] || 0;
                const isBidderTeam = team.id === bidderTeam?.id;
                const displayRoundScore = isBidderTeam && roundScore < highBid ? -highBid : roundScore;
                const teamPlayers = players.filter(p => p.teamId === team.id);
                const isYourTeam = team.id === localTeamId;

                return (
                  <motion.div
                    key={team.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl',
                      'bg-muted/50',
                      isGameOver && index === 0 && isYourTeam && 'bg-[hsl(var(--gold)/0.1)] ring-2 ring-[hsl(var(--gold)/0.4)]',
                      isGameOver && index === 0 && !isYourTeam && 'bg-red-100 dark:bg-red-900/30 ring-2 ring-red-400'
                    )}
                    data-testid={`score-row-${team.id}`}
                  >
                    <div className="flex flex-col gap-0.5 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isGameOver && index === 0 && (
                          <Trophy className="w-4 h-4 text-[hsl(var(--gold))]" />
                        )}
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          team.id === 'team1' ? 'bg-[hsl(var(--team-blue))]' : 'bg-[hsl(var(--team-red))]'
                        )} />
                        <span className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                          {team.id === 'team1' ? 'Your Team' : 'Opponents'}
                        </span>
                        {isBidderTeam && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Bid {highBid}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground ml-4">
                        {teamPlayers.map(p => p.name).join(' & ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isGameOver && (
                        <span
                          className={cn(
                            'text-sm font-medium',
                            isYourTeam && displayRoundScore > 0 && 'text-emerald-600 dark:text-emerald-400',
                            isYourTeam && displayRoundScore < 0 && 'text-red-600 dark:text-red-400',
                            !isYourTeam && displayRoundScore > 0 && 'text-red-600 dark:text-red-400',
                            !isYourTeam && displayRoundScore < 0 && 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {displayRoundScore > 0 ? '+' : ''}{displayRoundScore}
                        </span>
                      )}
                      <div className="text-right">
                        <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{team.score}</span>
                        <span className="text-xs text-muted-foreground">/{targetScore}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={onContinue}
            className="w-full shadow-[0_0_20px_hsl(var(--gold)/0.15)]"
            style={{ fontFamily: 'var(--font-display)' }}
            size="lg"
            disabled={!canContinue}
            data-testid="button-continue"
          >
            {canContinue
              ? (isGameOver ? 'New Game' : 'Continue to Next Round')
              : `Review scores... (${countdown})`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

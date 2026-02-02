import { GameState, Suit, Team } from '@shared/gameTypes';
import { Button } from '@/components/ui/button';
import { Settings, Share2, HelpCircle, History, LogOut, Trophy } from 'lucide-react';
import { SuitIcon } from '@/components/ui/suit-utils';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

interface GameHeaderProps {
  gameState: GameState;
  onSettingsClick: () => void;
  onShareClick: () => void;
  onRulesClick: () => void;
  onLastTrickClick?: () => void;
  onExitGame?: () => void;
}

const getPhaseLabel = (phase: GameState['phase'], trickNumber: number): string => {
  switch (phase) {
    case 'setup':
      return 'READY';
    case 'dealer-draw':
      return 'DRAW';
    case 'dealing':
      return 'DEAL';
    case 'bidding':
      return 'BID';
    case 'trump-selection':
      return 'TRUMP';
    case 'purge-draw':
      return 'PURGE';
    case 'playing':
      return `TRICK ${Math.min(trickNumber, 6)}/6`;
    case 'scoring':
      return 'SCORE';
    case 'game-over':
      return 'FINAL';
    default:
      return '';
  }
};

const TeamScore = ({ team, isYourTeam, targetScore }: { team: Team; isYourTeam: boolean; targetScore: number }) => {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg',
        'border backdrop-blur-sm transition-all',
        isYourTeam
          ? 'bg-[hsl(var(--team-blue)/0.12)] border-[hsl(var(--team-blue)/0.25)]'
          : 'bg-[hsl(var(--team-red)/0.12)] border-[hsl(var(--team-red)/0.25)]'
      )}
      data-testid={`team-score-${team.id}`}
    >
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        isYourTeam ? 'bg-[hsl(var(--team-blue))]' : 'bg-[hsl(var(--team-red))]'
      )} />
      <span className={cn(
        'text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest',
        isYourTeam ? 'text-[hsl(var(--team-blue))]' : 'text-[hsl(var(--team-red))]'
      )}>
        {isYourTeam ? 'YOU' : 'OPP'}
      </span>
      <span className="font-bold text-sm sm:text-base tabular-nums">{team.score}</span>
      <span className="text-[10px] sm:text-xs text-muted-foreground/50 tabular-nums">/{targetScore}</span>
    </div>
  );
};

export function GameHeader({ gameState, onSettingsClick, onShareClick, onRulesClick, onLastTrickClick, onExitGame }: GameHeaderProps) {
  const phaseLabel = getPhaseLabel(gameState.phase, gameState.trickNumber);
  const yourTeam = gameState.teams.find(t => t.id === 'team1');
  const opponentTeam = gameState.teams.find(t => t.id === 'team2');

  return (
    <header
      className="flex items-center justify-between gap-2 px-2 py-1.5 sm:px-4 sm:py-2 border-b border-border/50 bg-background/60 backdrop-blur-md"
      data-testid="game-header"
    >
      {/* Left: Phase + bid */}
      <div className="flex items-center gap-2">
        <div className="px-2 py-0.5 rounded bg-muted/50 border border-border/50">
          <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.15em] text-muted-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            {phaseLabel}
          </span>
        </div>

        {gameState.highBid > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[hsl(var(--gold)/0.08)] border border-[hsl(var(--gold)/0.2)]">
            <span className="text-[10px] font-medium text-[hsl(var(--gold))]">
              BID {gameState.highBid}
            </span>
          </div>
        )}
      </div>

      {/* Center: Scores */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-shrink">
        {yourTeam && gameState.phase !== 'setup' && (
          <TeamScore team={yourTeam} isYourTeam targetScore={gameState.targetScore} />
        )}
        <span className="text-muted-foreground/30 text-[10px] font-medium hidden xs:inline">vs</span>
        {opponentTeam && gameState.phase !== 'setup' && (
          <TeamScore team={opponentTeam} isYourTeam={false} targetScore={gameState.targetScore} />
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
        {gameState.trumpSuit && (
          <div
            className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg bg-[hsl(var(--gold)/0.1)] border border-[hsl(var(--gold)/0.2)]"
            data-testid="display-trump-suit"
          >
            <SuitIcon suit={gameState.trumpSuit} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        )}

        {gameState.lastTrick && gameState.lastTrick.length > 0 && onLastTrickClick && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onLastTrickClick}
            className="hidden sm:flex h-8 w-8 text-muted-foreground/60 hover:text-foreground"
            data-testid="button-last-trick-header"
          >
            <History className="w-3.5 h-3.5" />
          </Button>
        )}

        <Button
          size="icon"
          variant="ghost"
          onClick={onShareClick}
          className="hidden sm:flex h-8 w-8 text-muted-foreground/60 hover:text-foreground"
          data-testid="button-share"
        >
          <Share2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRulesClick}
          className="hidden xs:flex h-8 w-8 text-muted-foreground/60 hover:text-foreground"
          data-testid="button-rules"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onSettingsClick}
          className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
          data-testid="button-settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>

        <Link href="/stats">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
            data-testid="button-stats"
          >
            <Trophy className="w-3.5 h-3.5" />
          </Button>
        </Link>

        {onExitGame && gameState.phase !== 'setup' && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onExitGame}
            className="h-8 w-8 text-destructive/70 hover:text-destructive"
            data-testid="button-exit-game"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </header>
  );
}

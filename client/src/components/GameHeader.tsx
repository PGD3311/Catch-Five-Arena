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
      return `${Math.min(trickNumber, 6)}/6`;
    case 'scoring':
      return 'SCORE';
    case 'game-over':
      return 'FINAL';
    default:
      return '';
  }
};

export function GameHeader({ gameState, onSettingsClick, onShareClick, onRulesClick, onLastTrickClick, onExitGame }: GameHeaderProps) {
  const phaseLabel = getPhaseLabel(gameState.phase, gameState.trickNumber);
  const yourTeam = gameState.teams.find(t => t.id === 'team1');
  const opponentTeam = gameState.teams.find(t => t.id === 'team2');
  
  const isInGame = gameState.phase !== 'setup';

  return (
    <header
      className="flex items-center justify-between gap-1 px-2 py-1.5 sm:px-4 sm:py-2 border-b border-border/50 bg-background/60 backdrop-blur-md"
      data-testid="game-header"
    >
      {/* Left: Exit button */}
      <div className="flex items-center flex-shrink-0">
        {onExitGame && isInGame && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onExitGame}
            className="h-8 w-8 text-destructive/70 hover:text-destructive"
            data-testid="button-exit-game"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Center: Scoreboard hero - YOUR_SCORE  ♥BID · PHASE  OPP_SCORE */}
      {isInGame && (
        <div className="flex items-center justify-center gap-1.5 sm:gap-3 flex-1">
          {/* Your team score */}
          {yourTeam && (
            <div
              className={cn(
                'flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md',
                'bg-[hsl(var(--team-blue)/0.12)] border border-[hsl(var(--team-blue)/0.25)]'
              )}
              data-testid="team-score-team1"
            >
              <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-[hsl(var(--team-blue))]">
                YOU
              </span>
              <span className="font-bold text-sm sm:text-lg tabular-nums">{yourTeam.score}</span>
            </div>
          )}

          {/* Center divider: Trump + Bid · Phase */}
          <div className="flex items-center gap-0.5 sm:gap-1 text-muted-foreground">
            {gameState.trumpSuit && (
              <SuitIcon suit={gameState.trumpSuit} className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            )}
            {gameState.highBid > 0 && (
              <span className="font-bold text-xs sm:text-base tabular-nums">{gameState.highBid}</span>
            )}
            {(gameState.trumpSuit || gameState.highBid > 0) && phaseLabel && (
              <span className="text-muted-foreground/40 mx-0.5 hidden xs:inline">·</span>
            )}
            {phaseLabel && (
              <span className="text-[9px] sm:text-xs font-medium text-muted-foreground/70 hidden xs:inline">
                {phaseLabel}
              </span>
            )}
          </div>

          {/* Opponent team score */}
          {opponentTeam && (
            <div
              className={cn(
                'flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md',
                'bg-[hsl(var(--team-red)/0.12)] border border-[hsl(var(--team-red)/0.25)]'
              )}
              data-testid="team-score-team2"
            >
              <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-wide text-[hsl(var(--team-red))]">
                OPP
              </span>
              <span className="font-bold text-sm sm:text-lg tabular-nums">{opponentTeam.score}</span>
            </div>
          )}
        </div>
      )}

      {/* Right: Action buttons - fewer on mobile, all on desktop */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* History - only on desktop */}
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
        
        {/* Share - only on desktop */}
        <Button
          size="icon"
          variant="ghost"
          onClick={onShareClick}
          className="hidden sm:flex h-8 w-8 text-muted-foreground/60 hover:text-foreground"
          data-testid="button-share"
        >
          <Share2 className="w-3.5 h-3.5" />
        </Button>
        
        {/* Rules - only on desktop */}
        <Button
          size="icon"
          variant="ghost"
          onClick={onRulesClick}
          className="hidden sm:flex h-8 w-8 text-muted-foreground/60 hover:text-foreground"
          data-testid="button-rules"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </Button>
        
        {/* Settings - always visible */}
        <Button
          size="icon"
          variant="ghost"
          onClick={onSettingsClick}
          className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
          data-testid="button-settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>
        
        {/* Stats - always visible */}
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
      </div>
    </header>
  );
}

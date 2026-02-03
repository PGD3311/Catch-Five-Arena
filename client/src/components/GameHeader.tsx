import { useState } from 'react';
import { GameState, Suit, Team } from '@shared/gameTypes';
import { Button } from '@/components/ui/button';
import { Settings, Share2, HelpCircle, History, LogOut, Trophy, MoreHorizontal } from 'lucide-react';
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
  hideScores?: boolean;
}

const getPhaseLabel = (phase: GameState['phase'], trickNumber: number): string => {
  switch (phase) {
    case 'setup': return 'READY';
    case 'dealer-draw': return 'DRAW';
    case 'dealing': return 'DEAL';
    case 'bidding': return 'BID';
    case 'trump-selection': return 'TRUMP';
    case 'purge-draw': return 'PURGE';
    case 'discard-trump': return 'DISCARD';
    case 'playing': return `${Math.min(trickNumber, 6)}/6`;
    case 'scoring': return 'SCORE';
    case 'game-over': return 'FINAL';
    default: return '';
  }
};

export function GameHeader({ gameState, onSettingsClick, onShareClick, onRulesClick, onLastTrickClick, onExitGame, hideScores = false }: GameHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const phaseLabel = getPhaseLabel(gameState.phase, gameState.trickNumber);
  const yourTeam = gameState.teams.find(t => t.id === 'team1');
  const opponentTeam = gameState.teams.find(t => t.id === 'team2');
  const isPlaying = gameState.phase !== 'setup';
  const hasLastTrick = gameState.lastTrick && gameState.lastTrick.length > 0 && onLastTrickClick;
  const bidderTeamId = gameState.bidderId
    ? gameState.players.find(p => p.id === gameState.bidderId)?.teamId
    : null;

  const menuItems = [
    hasLastTrick && { icon: History, label: 'Last Trick', onClick: onLastTrickClick!, testId: 'menu-last-trick' },
    { icon: Share2, label: 'Share', onClick: onShareClick, testId: 'menu-share' },
    { icon: HelpCircle, label: 'Rules', onClick: onRulesClick, testId: 'menu-rules' },
    { icon: Settings, label: 'Settings', onClick: onSettingsClick, testId: 'menu-settings' },
  ].filter(Boolean) as { icon: any; label: string; onClick: () => void; testId: string }[];

  return (
    <header className="relative flex items-center justify-between px-2 py-1.5 sm:px-3 border-b border-border/50 bg-background/60 backdrop-blur-md" data-testid="game-header">
      {/* Left: Exit button or spacer */}
      <div className="min-w-[40px] sm:min-w-[44px] flex items-center">
        {onExitGame && isPlaying && (
          <Button size="icon" variant="ghost" onClick={onExitGame} className="h-8 w-8 text-muted-foreground/60 hover:text-destructive" data-testid="button-exit-game">
            <LogOut className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Center: Scoreboard */}
      {isPlaying ? (
        <div className="flex items-center gap-2 sm:gap-3">
          {yourTeam && (
            <div className="flex items-center gap-1.5" data-testid={`team-score-${yourTeam.id}`}>
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--team-blue))]" />
              <span className={cn("text-lg sm:text-xl font-bold tabular-nums transition-opacity duration-500", hideScores && "opacity-0")}>{yourTeam.score}</span>
            </div>
          )}

          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/40 border border-border/30">
            {gameState.trumpSuit && <SuitIcon suit={gameState.trumpSuit} className="w-3.5 h-3.5" />}
            {gameState.highBid > 0 && (
              <span className={cn(
                'text-xs font-bold tabular-nums',
                bidderTeamId === 'team1' ? 'text-[hsl(var(--team-blue))]'
                  : bidderTeamId === 'team2' ? 'text-[hsl(var(--team-red))]'
                  : 'text-[hsl(var(--gold))]'
              )}>{gameState.highBid}</span>
            )}
            {(gameState.trumpSuit || gameState.highBid > 0) && phaseLabel && (
              <span className="text-muted-foreground/25 text-xs">&middot;</span>
            )}
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-muted-foreground/60">{phaseLabel}</span>
          </div>

          {opponentTeam && (
            <div className="flex items-center gap-1.5" data-testid={`team-score-${opponentTeam.id}`}>
              <span className={cn("text-lg sm:text-xl font-bold tabular-nums transition-opacity duration-500", hideScores && "opacity-0")}>{opponentTeam.score}</span>
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--team-red))]" />
            </div>
          )}
        </div>
      ) : (
        <span className="text-xs font-bold tracking-[0.15em] text-muted-foreground/50">{phaseLabel}</span>
      )}

      {/* Right: Actions */}
      <div className="min-w-[40px] sm:min-w-[44px] flex items-center justify-end">
        {/* Desktop buttons */}
        <div className="hidden sm:flex items-center gap-0.5">
          {menuItems.map(item => (
            <Button key={item.testId} size="icon" variant="ghost" onClick={item.onClick} className="h-8 w-8 text-muted-foreground/50 hover:text-foreground" data-testid={item.testId.replace('menu-', 'button-')}>
              <item.icon className="w-3.5 h-3.5" />
            </Button>
          ))}
          <Link href="/stats">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground/50 hover:text-foreground" data-testid="button-stats">
              <Trophy className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        {/* Mobile overflow menu */}
        <div className="sm:hidden relative">
          <Button size="icon" variant="ghost" onClick={() => setMenuOpen(prev => !prev)} className="h-8 w-8 text-muted-foreground/60 hover:text-foreground" data-testid="button-menu">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-card/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-xl py-1 min-w-[140px]">
                {menuItems.map(item => (
                  <button key={item.testId} onClick={() => { item.onClick(); setMenuOpen(false); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50" data-testid={item.testId}>
                    <item.icon className="w-3.5 h-3.5 text-muted-foreground/60" /> {item.label}
                  </button>
                ))}
                <Link href="/stats">
                  <button onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50" data-testid="menu-stats">
                    <Trophy className="w-3.5 h-3.5 text-muted-foreground/60" /> Stats
                  </button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

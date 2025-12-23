import { GameState, Suit, Team } from '@shared/gameTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, Heart, Diamond, Club, Spade, Users, Share2, HelpCircle, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface GameHeaderProps {
  gameState: GameState;
  onSettingsClick: () => void;
  onShareClick: () => void;
  onRulesClick: () => void;
  onLastTrickClick?: () => void;
}

const TrumpIcon = ({ suit }: { suit: Suit }) => {
  const Icon = {
    Hearts: Heart,
    Diamonds: Diamond,
    Clubs: Club,
    Spades: Spade,
  }[suit];

  const colors = {
    Hearts: 'text-red-500',
    Diamonds: 'text-blue-500',
    Clubs: 'text-emerald-500',
    Spades: 'text-slate-400',
  };

  return <Icon className={cn('w-4 h-4', colors[suit])} fill="currentColor" />;
};

const getPhaseLabel = (phase: GameState['phase'], trickNumber: number): string => {
  switch (phase) {
    case 'setup':
      return 'Ready';
    case 'dealer-draw':
      return 'Drawing';
    case 'dealing':
      return 'Dealing';
    case 'bidding':
      return 'Bidding Phase';
    case 'trump-selection':
      return 'Select Trump';
    case 'purge-draw':
      return 'Purge & Draw';
    case 'playing':
      return `Trick ${Math.min(trickNumber, 6)}/6`;
    case 'scoring':
      return 'Round End';
    case 'game-over':
      return 'Game Over';
    default:
      return '';
  }
};

const TeamScore = ({ team, isYourTeam, targetScore }: { team: Team; isYourTeam: boolean; targetScore: number }) => {
  return (
    <div 
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full border',
        isYourTeam 
          ? 'bg-blue-500/10 border-blue-500/30' 
          : 'bg-rose-500/10 border-rose-500/30'
      )}
      data-testid={`team-score-${team.id}`}
    >
      <Users className={cn('w-3.5 h-3.5', isYourTeam ? 'text-blue-400' : 'text-rose-400')} />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground hidden sm:inline">
        {isYourTeam ? 'YOUR TEAM' : 'OPPONENTS'}
      </span>
      <span className="font-semibold text-sm">{team.score}</span>
      <span className="text-xs text-muted-foreground">/{targetScore}</span>
    </div>
  );
};

export function GameHeader({ gameState, onSettingsClick, onShareClick, onRulesClick, onLastTrickClick }: GameHeaderProps) {
  const phaseLabel = getPhaseLabel(gameState.phase, gameState.trickNumber);
  const yourTeam = gameState.teams.find(t => t.id === 'team1');
  const opponentTeam = gameState.teams.find(t => t.id === 'team2');

  return (
    <header className="flex items-center justify-between gap-2 px-2 py-1.5 sm:px-3 sm:py-2 border-b bg-background/80 backdrop-blur-sm" data-testid="game-header">
      {/* Left: Phase and bid info */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge 
          variant="secondary" 
          className="text-[11px] font-medium px-2 py-0.5"
          data-testid="badge-phase"
        >
          {phaseLabel}
        </Badge>

        {gameState.highBid > 0 && (
          <Badge 
            variant="outline" 
            className="text-[11px] px-2 py-0.5 border-amber-500/40 text-amber-400" 
            data-testid="badge-high-bid"
          >
            Bid: {gameState.highBid}
          </Badge>
        )}
      </div>

      {/* Center: Team scores */}
      <div className="flex items-center gap-2">
        {yourTeam && gameState.phase !== 'setup' && (
          <TeamScore team={yourTeam} isYourTeam targetScore={gameState.targetScore} />
        )}
        {opponentTeam && gameState.phase !== 'setup' && (
          <TeamScore team={opponentTeam} isYourTeam={false} targetScore={gameState.targetScore} />
        )}
      </div>

      {/* Right: Trump and actions */}
      <div className="flex items-center gap-1.5">
        {gameState.trumpSuit && (
          <div 
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20"
            data-testid="display-trump-suit"
          >
            <TrumpIcon suit={gameState.trumpSuit} />
          </div>
        )}

        {gameState.lastTrick && gameState.lastTrick.length > 0 && onLastTrickClick && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onLastTrickClick}
            data-testid="button-last-trick-header"
          >
            <History className="w-4 h-4" />
          </Button>
        )}

        <Button
          size="icon"
          variant="ghost"
          onClick={onShareClick}
          data-testid="button-share"
        >
          <Share2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRulesClick}
          data-testid="button-rules"
        >
          <HelpCircle className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onSettingsClick}
          data-testid="button-settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}

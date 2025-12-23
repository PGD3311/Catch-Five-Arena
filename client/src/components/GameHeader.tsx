import { GameState, Suit, Team } from '@shared/gameTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, Heart, Diamond, Club, Spade, Users, Share2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameHeaderProps {
  gameState: GameState;
  onSettingsClick: () => void;
  onShareClick: () => void;
  onRulesClick: () => void;
}

const SuitDisplay = ({ suit }: { suit: Suit }) => {
  const isRed = suit === 'Hearts' || suit === 'Diamonds';
  const color = isRed ? 'text-red-500' : 'text-foreground';

  const Icon = {
    Hearts: Heart,
    Diamonds: Diamond,
    Clubs: Club,
    Spades: Spade,
  }[suit];

  return (
    <div className={cn('flex items-center gap-1.5', color)}>
      <Icon className="w-5 h-5" fill="currentColor" />
      <span className="font-semibold text-sm">{suit}</span>
    </div>
  );
};

const getPhaseLabel = (phase: GameState['phase'], trickNumber: number): string => {
  switch (phase) {
    case 'setup':
      return 'Ready to Start';
    case 'dealing':
      return 'Dealing Cards...';
    case 'bidding':
      return 'Bidding Phase';
    case 'trump-selection':
      return 'Select Trump';
    case 'purge-draw':
      return 'Purge & Draw';
    case 'playing':
      return `Trick ${Math.min(trickNumber, 6)} of 6`;
    case 'scoring':
      return 'Round Complete';
    case 'game-over':
      return 'Game Over';
    default:
      return '';
  }
};

const TeamScoreDisplay = ({ team, isYourTeam, targetScore }: { team: Team; isYourTeam: boolean; targetScore: number }) => (
  <div 
    className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-lg',
      isYourTeam ? 'bg-primary/10' : 'bg-muted'
    )}
    data-testid={`team-score-${team.id}`}
  >
    <Users className="w-4 h-4 text-muted-foreground" />
    <span className="text-xs text-muted-foreground">{team.name}:</span>
    <span className={cn('font-bold', isYourTeam && 'text-primary')}>{team.score}</span>
    <span className="text-xs text-muted-foreground">/{targetScore}</span>
  </div>
);

export function GameHeader({ gameState, onSettingsClick, onShareClick, onRulesClick }: GameHeaderProps) {
  const phaseLabel = getPhaseLabel(gameState.phase, gameState.trickNumber);
  const yourTeam = gameState.teams.find(t => t.id === 'team1');
  const opponentTeam = gameState.teams.find(t => t.id === 'team2');

  return (
    <header className="flex items-center justify-between gap-4 p-4 border-b bg-card" data-testid="game-header">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className="text-sm font-semibold px-3 py-1" data-testid="badge-phase">
          {phaseLabel}
        </Badge>

        {gameState.highBid > 0 && (
          <Badge variant="outline" className="text-sm" data-testid="badge-high-bid">
            Bid: {gameState.highBid}
          </Badge>
        )}

        {gameState.trumpSuit && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary" data-testid="display-trump-suit">
            <span className="text-xs text-muted-foreground">Trump:</span>
            <SuitDisplay suit={gameState.trumpSuit} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {yourTeam && gameState.phase !== 'setup' && (
          <TeamScoreDisplay team={yourTeam} isYourTeam targetScore={gameState.targetScore} />
        )}
        {opponentTeam && gameState.phase !== 'setup' && (
          <TeamScoreDisplay team={opponentTeam} isYourTeam={false} targetScore={gameState.targetScore} />
        )}

        <div className="flex items-center gap-1 ml-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={onShareClick}
            data-testid="button-share"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onRulesClick}
            data-testid="button-rules"
            title="Rules"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onSettingsClick}
            data-testid="button-settings"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

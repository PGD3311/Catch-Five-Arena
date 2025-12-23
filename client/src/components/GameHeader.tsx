import { GameState, Suit } from '@shared/gameTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, Heart, Diamond, Club, Spade } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameHeaderProps {
  gameState: GameState;
  onSettingsClick: () => void;
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
      <Icon className="w-6 h-6" fill="currentColor" />
      <span className="font-bold">{suit}</span>
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

export function GameHeader({ gameState, onSettingsClick }: GameHeaderProps) {
  const phaseLabel = getPhaseLabel(gameState.phase, gameState.trickNumber);

  return (
    <header className="flex items-center justify-between gap-4 p-4 border-b bg-card" data-testid="game-header">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className="text-sm font-semibold px-3 py-1" data-testid="badge-phase">
          {phaseLabel}
        </Badge>

        {gameState.highBid > 0 && (
          <Badge variant="outline" className="text-sm" data-testid="badge-high-bid">
            High Bid: {gameState.highBid}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        {gameState.trumpSuit && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary" data-testid="display-trump-suit">
            <span className="text-sm text-muted-foreground">Trump:</span>
            <SuitDisplay suit={gameState.trumpSuit} />
          </div>
        )}

        <Button
          size="icon"
          variant="ghost"
          onClick={onSettingsClick}
          data-testid="button-settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}

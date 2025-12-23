import { TrickCard, Player } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';

interface TrickAreaProps {
  currentTrick: TrickCard[];
  players: Player[];
}

export function TrickArea({ currentTrick, players }: TrickAreaProps) {
  const getPositionForPlayer = (playerId: string): { x: string; y: string } => {
    const playerIndex = players.findIndex(p => p.id === playerId);
    switch (playerIndex) {
      case 0:
        return { x: '50%', y: '70%' };
      case 1:
        return { x: '25%', y: '50%' };
      case 2:
        return { x: '50%', y: '25%' };
      case 3:
        return { x: '75%', y: '50%' };
      default:
        return { x: '50%', y: '50%' };
    }
  };

  const getPlayerName = (playerId: string): string => {
    return players.find(p => p.id === playerId)?.name || '';
  };

  return (
    <div className="relative w-full h-48 md:h-64" data-testid="trick-area">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-48 h-32 md:w-64 md:h-44 rounded-xl bg-emerald-800/30 dark:bg-emerald-900/40 border border-emerald-600/20" />
      </div>

      {currentTrick.map((trickCard, index) => {
        const pos = getPositionForPlayer(trickCard.playerId);
        return (
          <div
            key={trickCard.card.id}
            className="absolute transition-all duration-500 ease-out"
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)',
              zIndex: index + 1,
            }}
          >
            <div className="relative">
              <PlayingCard card={trickCard.card} small />
              <span
                className={cn(
                  'absolute -bottom-5 left-1/2 -translate-x-1/2',
                  'text-xs font-medium text-muted-foreground whitespace-nowrap',
                  'bg-background/80 px-1.5 py-0.5 rounded'
                )}
              >
                {getPlayerName(trickCard.playerId)}
              </span>
            </div>
          </div>
        );
      })}

      {currentTrick.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-muted-foreground" data-testid="text-trick-prompt">Play a card to start the trick</span>
        </div>
      )}
    </div>
  );
}

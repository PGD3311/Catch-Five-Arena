import { Player, DeckColor, Card as CardType, Team } from '@shared/gameTypes';
import { PlayingCard, CardBack } from './PlayingCard';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { User, Bot, Crown, Users } from 'lucide-react';

interface PlayerAreaProps {
  player: Player;
  team: Team;
  isCurrentPlayer: boolean;
  isBidder: boolean;
  deckColor: DeckColor;
  onCardClick?: (card: CardType) => void;
  canPlayCard?: (card: CardType) => boolean;
  position: 'bottom' | 'top' | 'left' | 'right';
  showCards?: boolean;
}

export function PlayerArea({
  player,
  team,
  isCurrentPlayer,
  isBidder,
  deckColor,
  onCardClick,
  canPlayCard,
  position,
  showCards = false,
}: PlayerAreaProps) {
  const isBottom = position === 'bottom';
  const isTop = position === 'top';
  const isSide = position === 'left' || position === 'right';
  const isYourTeam = team.id === 'team1';

  const getContainerClasses = () => {
    const base = 'flex items-center gap-3';
    if (isBottom) return cn(base, 'flex-col');
    if (isTop) return cn(base, 'flex-col-reverse');
    if (position === 'left') return cn(base, 'flex-row');
    return cn(base, 'flex-row-reverse');
  };

  const getHandClasses = () => {
    if (isBottom) return 'flex justify-center items-end';
    if (isTop) return 'flex justify-center items-start';
    if (isSide) return 'flex flex-col items-center';
    return 'flex';
  };

  return (
    <div className={getContainerClasses()} data-testid={`player-area-${player.id}`}>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-card border border-card-border',
          isCurrentPlayer && 'ring-2 ring-primary animate-pulse',
          isSide ? 'flex-col text-center' : 'flex-row'
        )}
      >
        <div className="flex items-center gap-2">
          {player.isHuman ? (
            <User className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Bot className="w-5 h-5 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm">{player.name}</span>
          {isBidder && <Crown className="w-4 h-4 text-amber-500" />}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge 
            variant={isYourTeam ? 'default' : 'secondary'} 
            className="text-xs"
            data-testid={`team-badge-${player.id}`}
          >
            <Users className="w-3 h-3 mr-1" />
            {team.name}: {team.score}
          </Badge>
          {player.bid !== null && player.bid > 0 && (
            <Badge variant="outline" className="text-xs">
              Bid: {player.bid}
            </Badge>
          )}
        </div>
      </div>

      <div className={getHandClasses()}>
        {showCards ? (
          player.hand.map((card, index) => {
            const canPlay = canPlayCard ? canPlayCard(card) : true;
            const rotation = isBottom ? ((index - (player.hand.length - 1) / 2) * 3) : 0;

            return (
              <div
                key={card.id}
                style={{
                  marginLeft: isBottom && index > 0 ? '-24px' : undefined,
                  marginTop: isSide && index > 0 ? '-48px' : undefined,
                  transform: isBottom ? `rotate(${rotation}deg)` : undefined,
                  zIndex: index,
                }}
              >
                <PlayingCard
                  card={card}
                  onClick={() => onCardClick?.(card)}
                  disabled={!canPlay || !isCurrentPlayer}
                  small={!isBottom}
                />
              </div>
            );
          })
        ) : (
          player.hand.map((_, index) => (
            <div
              key={index}
              style={{
                marginLeft: !isSide && index > 0 ? '-40px' : undefined,
                marginTop: isSide && index > 0 ? '-48px' : undefined,
                zIndex: index,
              }}
            >
              <CardBack deckColor={deckColor} small />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

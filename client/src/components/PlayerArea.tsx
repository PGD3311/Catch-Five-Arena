import { Player, DeckColor, Card as CardType, Team } from '@shared/gameTypes';
import { PlayingCard, CardBack } from './PlayingCard';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { User, Bot, Crown, Users, CircleDot } from 'lucide-react';

interface PlayerAreaProps {
  player: Player;
  team: Team;
  isCurrentPlayer: boolean;
  isBidder: boolean;
  isDealer: boolean;
  deckColor: DeckColor;
  onCardClick?: (card: CardType) => void;
  canPlayCard?: (card: CardType) => boolean;
  position: 'bottom' | 'top' | 'left' | 'right';
  showCards?: boolean;
  showBidResult?: boolean;
}

export function PlayerArea({
  player,
  team,
  isCurrentPlayer,
  isBidder,
  isDealer,
  deckColor,
  onCardClick,
  canPlayCard,
  position,
  showCards = false,
  showBidResult = false,
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
          'relative flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-card border',
          isCurrentPlayer 
            ? 'border-primary ring-2 ring-primary/50 shadow-lg shadow-primary/20' 
            : 'border-card-border',
          isSide ? 'flex-col text-center' : 'flex-row'
        )}
      >
        {isDealer && (
          <div 
            className={cn(
              'absolute -top-2 -right-2 w-6 h-6 rounded-full',
              'bg-amber-500 text-white flex items-center justify-center',
              'text-[10px] font-bold shadow-md border-2 border-white dark:border-background'
            )}
            title="Dealer"
            data-testid={`dealer-chip-${player.id}`}
          >
            D
          </div>
        )}
        
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
            {team.name}
          </Badge>
          
          {showBidResult && player.bid !== null && (
            <Badge 
              variant={player.bid > 0 ? 'outline' : 'secondary'} 
              className="text-xs"
              data-testid={`bid-result-${player.id}`}
            >
              {player.bid === 0 ? 'Passed' : `Bid ${player.bid}`}
            </Badge>
          )}
        </div>

        {isCurrentPlayer && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
            <CircleDot className="w-3 h-3 text-primary animate-pulse" />
          </div>
        )}
      </div>

      <div className={cn(getHandClasses(), isBottom && 'min-h-36 pt-2')}>
        {showCards ? (
          player.hand.map((card, index) => {
            const canPlay = canPlayCard ? canPlayCard(card) : true;
            const cardCount = player.hand.length;
            const spreadAngle = cardCount > 6 ? 2.5 : 3.5;
            const rotation = isBottom ? ((index - (cardCount - 1) / 2) * spreadAngle) : 0;
            const overlap = cardCount > 6 ? -20 : -16;

            return (
              <div
                key={card.id}
                style={{
                  marginLeft: isBottom && index > 0 ? `${overlap}px` : undefined,
                  marginTop: isSide && index > 0 ? '-48px' : undefined,
                  transform: isBottom ? `rotate(${rotation}deg)` : undefined,
                  zIndex: index,
                }}
                className="transition-transform duration-150"
              >
                <PlayingCard
                  card={card}
                  onClick={() => onCardClick?.(card)}
                  disabled={!canPlay || !isCurrentPlayer}
                  small={false}
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

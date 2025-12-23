import { Player, DeckColor, Card as CardType, Team, Suit } from '@shared/gameTypes';
import { PlayingCard, CardBack } from './PlayingCard';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { User, Bot, Crown, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  trumpSuit?: Suit | null;
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
  trumpSuit,
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
      <motion.div
        animate={isCurrentPlayer ? { 
          boxShadow: [
            '0 0 0 0 rgba(var(--primary-rgb), 0)',
            '0 0 20px 4px rgba(var(--primary-rgb), 0.4)',
            '0 0 0 0 rgba(var(--primary-rgb), 0)'
          ]
        } : {}}
        transition={isCurrentPlayer ? { 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        } : {}}
        className={cn(
          'relative flex items-center gap-2 px-4 py-2.5 rounded-xl',
          'bg-gradient-to-br backdrop-blur-sm',
          isCurrentPlayer 
            ? 'from-primary/20 to-primary/5 border-2 border-primary shadow-lg shadow-primary/30' 
            : 'from-card/80 to-card/60 border border-border/50',
          isSide ? 'flex-col text-center' : 'flex-row',
          'transition-all duration-300'
        )}
      >
        {isDealer && (
          <motion.div 
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            className={cn(
              'absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full',
              'bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center',
              'text-[11px] font-bold shadow-lg border-2 border-amber-300/50'
            )}
            title="Dealer"
            data-testid={`dealer-chip-${player.id}`}
          >
            D
          </motion.div>
        )}
        
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            isYourTeam 
              ? 'bg-gradient-to-br from-blue-500/30 to-blue-600/20 border border-blue-400/30' 
              : 'bg-gradient-to-br from-rose-500/30 to-rose-600/20 border border-rose-400/30'
          )}>
            {player.isHuman ? (
              <User className="w-4 h-4 text-foreground/80" />
            ) : (
              <Bot className="w-4 h-4 text-foreground/80" />
            )}
          </div>
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm">{player.name}</span>
              {isBidder && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <Crown className="w-4 h-4 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" />
                </motion.div>
              )}
            </div>
            <span className={cn(
              'text-[10px] font-medium uppercase tracking-wider',
              isYourTeam ? 'text-blue-400' : 'text-rose-400'
            )}>
              {team.name}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {showBidResult && player.bid !== null && (
            <Badge 
              variant={player.bid > 0 ? 'outline' : 'secondary'} 
              className={cn(
                'text-xs',
                player.bid > 0 && 'border-amber-500/50 text-amber-400'
              )}
              data-testid={`bid-result-${player.id}`}
            >
              {player.bid === 0 ? 'Passed' : `Bid ${player.bid}`}
            </Badge>
          )}
        </div>

        {isCurrentPlayer && (
          <motion.div 
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary"
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{ 
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </motion.div>
        )}
      </motion.div>

      <div className={cn(getHandClasses(), isBottom && 'min-h-36 pt-2')}>
        <AnimatePresence mode="popLayout">
          {showCards ? (
            player.hand.map((card, index) => {
              const canPlay = canPlayCard ? canPlayCard(card) : true;
              const cardCount = player.hand.length;
              const spreadAngle = cardCount > 6 ? 2 : 3;
              const rotation = isBottom ? ((index - (cardCount - 1) / 2) * spreadAngle) : 0;
              const overlap = cardCount > 6 ? -18 : -14;

              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: -30 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  style={{
                    marginLeft: isBottom && index > 0 ? `${overlap}px` : undefined,
                    marginTop: isSide && index > 0 ? '-48px' : undefined,
                    rotate: isBottom ? rotation : 0,
                    zIndex: index,
                  }}
                >
                  <PlayingCard
                    card={card}
                    onClick={() => onCardClick?.(card)}
                    disabled={!canPlay || !isCurrentPlayer}
                    small={false}
                    trumpSuit={trumpSuit}
                  />
                </motion.div>
              );
            })
          ) : (
            player.hand.map((_, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  marginLeft: !isSide && index > 0 ? '-40px' : undefined,
                  marginTop: isSide && index > 0 ? '-48px' : undefined,
                  zIndex: index,
                }}
              >
                <CardBack deckColor={deckColor} small />
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

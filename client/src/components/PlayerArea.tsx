import { Player, DeckColor, Card as CardType, Team, Suit } from '@shared/gameTypes';
import { PlayingCard, CardBack } from './PlayingCard';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Bot, Crown, ArrowUpDown } from 'lucide-react';
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
  onSortHand?: () => void;
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
  onSortHand,
}: PlayerAreaProps) {
  const isBottom = position === 'bottom';
  const isTop = position === 'top';
  const isSide = position === 'left' || position === 'right';
  const isYourTeam = team.id === 'team1';

  const getContainerClasses = () => {
    const base = 'flex items-center gap-2';
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

  // Minimal chip for non-bottom players on mobile - Apple Wallet style
  const renderMinimalChip = () => (
    <div 
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'border backdrop-blur-sm transition-all',
        isCurrentPlayer 
          ? 'border-primary/50 bg-primary/10' 
          : 'border-border/30 bg-background/30'
      )}
      data-testid={`player-chip-${player.id}`}
    >
      <span className={cn(
        'text-[11px] font-medium',
        isYourTeam ? 'text-emerald-400' : 'text-foreground/70'
      )}>{player.name}</span>
      {isDealer && <span className="text-[9px] text-amber-400 font-semibold">D</span>}
      {isBidder && <Crown className="w-2.5 h-2.5 text-amber-400" />}
      {showBidResult && player.bid !== null && (
        <span className={cn(
          'text-[10px] font-medium',
          player.bid > 0 ? 'text-amber-400' : 'text-muted-foreground/60'
        )}>
          {player.bid === 0 ? 'Pass' : player.bid}
        </span>
      )}
      {isCurrentPlayer && (
        <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
      )}
    </div>
  );

  // Full player info panel for desktop and bottom player
  const renderFullPanel = () => (
    <motion.div
      animate={isCurrentPlayer ? { 
        boxShadow: [
          '0 0 0 0 rgba(var(--primary-rgb), 0)',
          '0 0 16px 3px rgba(var(--primary-rgb), 0.3)',
          '0 0 0 0 rgba(var(--primary-rgb), 0)'
        ]
      } : {}}
      transition={isCurrentPlayer ? { 
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      } : {}}
      className={cn(
        'relative flex items-center gap-2 px-3 py-2 rounded-xl',
        'backdrop-blur-sm border transition-all',
        isCurrentPlayer 
          ? 'bg-primary/10 border-primary/40' 
          : 'bg-card/50 border-border/30',
        isSide ? 'flex-col text-center' : 'flex-row'
      )}
    >
      {isDealer && (
        <div 
          className={cn(
            'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full',
            'bg-amber-500 text-white flex items-center justify-center',
            'text-[9px] font-bold'
          )}
          title="Dealer"
          data-testid={`dealer-chip-${player.id}`}
        >
          D
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center',
          isYourTeam 
            ? 'bg-emerald-500/20' 
            : 'bg-slate-500/20'
        )}>
          {player.isHuman ? (
            <User className="w-3 h-3 text-foreground/60" />
          ) : (
            <Bot className="w-3 h-3 text-foreground/60" />
          )}
        </div>
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm">{player.name}</span>
            {isBidder && (
              <Crown className="w-3 h-3 text-amber-400" />
            )}
          </div>
          <span className={cn(
            'text-[9px] font-medium uppercase tracking-wider',
            isYourTeam ? 'text-emerald-400/80' : 'text-muted-foreground/60'
          )}>
            {team.name}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 flex-wrap">
        {showBidResult && player.bid !== null && (
          <Badge 
            variant={player.bid > 0 ? 'outline' : 'secondary'} 
            className={cn(
              'text-[10px] px-1.5 py-0',
              player.bid > 0 && 'border-amber-500/40 text-amber-400'
            )}
            data-testid={`bid-result-${player.id}`}
          >
            {player.bid === 0 ? 'Pass' : `Bid ${player.bid}`}
          </Badge>
        )}
        {isBottom && showCards && onSortHand && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onSortHand}
            className="h-6 px-2 text-[10px]"
            data-testid="button-sort-hand"
          >
            <ArrowUpDown className="w-3 h-3 mr-1" />
            Sort
          </Button>
        )}
      </div>
    </motion.div>
  );

  // Bottom player's card fan with gradient backdrop
  const renderBottomCards = () => (
    <div className={cn(
      'relative w-full',
      'pb-2 pt-1'
    )}>
      {/* Gradient backdrop for breathing room */}
      <div className="absolute inset-x-0 bottom-0 h-32 sm:h-40 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
      
      <div className={cn(getHandClasses(), 'relative z-10 min-h-20 sm:min-h-28')}>
        <AnimatePresence mode="popLayout">
          {player.hand.map((card, index) => {
            const canPlay = canPlayCard ? canPlayCard(card) : true;
            const cardCount = player.hand.length;
            const spreadAngle = cardCount > 6 ? 1.5 : 2;
            const rotation = (index - (cardCount - 1) / 2) * spreadAngle;
            const mobileOverlap = cardCount > 6 ? -30 : -26;
            const desktopOverlap = cardCount > 6 ? -16 : -12;

            return (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: -30 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                style={{
                  marginLeft: index > 0 ? `clamp(${mobileOverlap}px, -4vw, ${desktopOverlap}px)` : undefined,
                  rotate: rotation,
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
          })}
        </AnimatePresence>
      </div>
    </div>
  );

  // Desktop card backs for non-bottom players
  const renderDesktopCardBacks = () => (
    <div className="hidden sm:flex flex-col items-center">
      <AnimatePresence mode="popLayout">
        {player.hand.map((_, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            style={{
              marginTop: isSide && index > 0 ? '-36px' : undefined,
              marginLeft: !isSide && index > 0 ? '-28px' : undefined,
              zIndex: index,
            }}
          >
            <CardBack deckColor={deckColor} small />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  return (
    <div className={getContainerClasses()} data-testid={`player-area-${player.id}`}>
      {!isBottom ? (
        <>
          {/* Mobile: minimal chip */}
          <div className="block sm:hidden">{renderMinimalChip()}</div>
          {/* Desktop: full panel */}
          <div className="hidden sm:block">{renderFullPanel()}</div>
          {/* Desktop: card backs */}
          {renderDesktopCardBacks()}
        </>
      ) : (
        <>
          {renderFullPanel()}
          {showCards && renderBottomCards()}
        </>
      )}
    </div>
  );
}

import { Player, DeckColor, Card as CardType, Team, Suit } from '@shared/gameTypes';
import { CardDock } from './CardDock';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Bot, Crown, ArrowUpDown } from 'lucide-react';

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

  const teamColors = isYourTeam
    ? { text: 'text-[hsl(var(--team-blue))]', bg: 'bg-[hsl(var(--team-blue)/0.12)]', border: 'border-[hsl(var(--team-blue)/0.3)]', dot: 'bg-[hsl(var(--team-blue))]' }
    : { text: 'text-[hsl(var(--team-red))]', bg: 'bg-[hsl(var(--team-red)/0.12)]', border: 'border-[hsl(var(--team-red)/0.3)]', dot: 'bg-[hsl(var(--team-red))]' };

  const getContainerClasses = () => {
    const base = 'flex items-center gap-2';
    if (isBottom) return cn(base, 'flex-col');
    if (isTop) return cn(base, 'flex-col-reverse');
    if (position === 'left') return cn(base, 'flex-row');
    return cn(base, 'flex-row-reverse');
  };

  // Minimal chip for non-bottom players on mobile
  const renderMinimalChip = () => (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
        'border backdrop-blur-sm transition-all',
        teamColors.border,
        teamColors.bg,
        isCurrentPlayer && 'active-player-glow'
      )}

      data-testid={`player-chip-${player.id}`}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', teamColors.dot)} />
      <span className={cn('text-xs font-medium', teamColors.text)} style={{ fontFamily: 'var(--font-display)' }}>{player.name}</span>
      {isDealer && (
        <span className="px-1 py-px text-[8px] font-bold rounded text-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)] border border-[hsl(var(--gold)/0.25)]">D</span>
      )}
      {isBidder && <Crown className="w-2.5 h-2.5 text-[hsl(var(--gold))]" />}
      {showBidResult && player.bid !== null && (
        <span className={cn(
          'text-[10px] font-semibold',
          player.bid > 0 ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground/50'
        )}>
          {player.bid === 0 ? 'Pass' : player.bid}
        </span>
      )}
      {isCurrentPlayer && (
        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--gold))] animate-pulse" />
      )}
    </div>
  );

  // Full player info panel for desktop
  const renderFullPanel = () => (
    <div
      className={cn(
        'relative flex items-center gap-2 px-3 py-2 rounded-xl',
        'backdrop-blur-sm border transition-all',
        isCurrentPlayer
          ? 'bg-[hsl(var(--gold)/0.08)] border-[hsl(var(--gold)/0.25)] active-player-glow'
          : 'bg-card/40 border-border/30',
        isSide ? 'flex-col text-center' : 'flex-row'
      )}

    >
      {isDealer && (
        <div
          className={cn(
            'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full',
            'bg-[hsl(var(--gold))] text-background flex items-center justify-center',
            'text-[9px] font-bold',
            'ring-2 ring-[hsl(var(--gold)/0.4)] ring-offset-1 ring-offset-background',
            'border border-[hsl(var(--gold)/0.3)]'
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
          teamColors.bg
        )}>
          {player.isHuman ? (
            <User className={cn('w-3 h-3', teamColors.text)} />
          ) : (
            <Bot className={cn('w-3 h-3', teamColors.text)} />
          )}
        </div>
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-1">
            <span className={cn('font-medium text-sm', teamColors.text)} style={{ fontFamily: 'var(--font-display)' }}>{player.name}</span>
            {isBidder && (
              <Crown className="w-3 h-3 text-[hsl(var(--gold))]" />
            )}
          </div>
          <span className={cn(
            'text-[9px] font-medium uppercase tracking-widest',
            teamColors.text, 'opacity-60'
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
              player.bid > 0 && 'border-[hsl(var(--gold)/0.3)] text-[hsl(var(--gold))]'
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
            className="h-6 px-2 text-[10px] text-muted-foreground/60"
            data-testid="button-sort-hand"
          >
            <ArrowUpDown className="w-3 h-3 mr-1" />
            Sort
          </Button>
        )}
      </div>
    </div>
  );

  // Bottom player's cards
  const renderBottomCards = () => (
    <CardDock
      cards={player.hand}
      onCardClick={onCardClick}
      canPlayCard={canPlayCard}
      isCurrentPlayer={isCurrentPlayer}
      trumpSuit={trumpSuit}
    />
  );

  return (
    <div className={getContainerClasses()} data-testid={`player-area-${player.id}`}>
      {!isBottom ? (
        <>
          {/* Mobile: minimal chip */}
          <div className="block sm:hidden">{renderMinimalChip()}</div>
          {/* Desktop: full panel */}
          <div className="hidden sm:block">{renderFullPanel()}</div>
        </>
      ) : (
        <>
          {/* Compact identity line for bottom player */}
          <div className="flex items-center justify-center gap-3 w-full px-4">
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
                teamColors.border, teamColors.bg, 'border',
                isCurrentPlayer && 'active-player-glow'
              )}
        
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', teamColors.dot)} />
              <span className={cn('text-xs font-medium', teamColors.text)} style={{ fontFamily: 'var(--font-display)' }}>{player.name}</span>
              {isDealer && (
                <span className="px-1 py-px text-[8px] font-bold rounded text-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.12)] border border-[hsl(var(--gold)/0.25)]">D</span>
              )}
              {isBidder && <Crown className="w-3 h-3 text-[hsl(var(--gold))]" />}
              {showBidResult && player.bid !== null && (
                <Badge
                  variant={player.bid > 0 ? 'outline' : 'secondary'}
                  className={cn(
                    'text-[9px] px-1.5 py-0 h-4',
                    player.bid > 0 && 'border-[hsl(var(--gold)/0.3)] text-[hsl(var(--gold))]'
                  )}
                >
                  {player.bid === 0 ? 'Pass' : player.bid}
                </Badge>
              )}
              {isCurrentPlayer && (
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--gold))] animate-pulse" />
              )}
            </div>
            {onSortHand && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onSortHand}
                className="h-8 w-8 text-muted-foreground/50 hover:text-foreground"
                data-testid="button-sort-hand"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          {showCards && renderBottomCards()}
        </>
      )}
    </div>
  );
}

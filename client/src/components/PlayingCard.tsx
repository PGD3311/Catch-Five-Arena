import { Card, DeckColor, DECK_COLORS } from '@shared/gameTypes';
import { cn } from '@/lib/utils';
import { Heart, Diamond, Club, Spade } from 'lucide-react';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  deckColor?: DeckColor;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  small?: boolean;
  className?: string;
}

const SuitIcon = ({ suit, className }: { suit: Card['suit']; className?: string }) => {
  const iconClass = cn('', className);
  switch (suit) {
    case 'Hearts':
      return <Heart className={iconClass} fill="currentColor" />;
    case 'Diamonds':
      return <Diamond className={iconClass} fill="currentColor" />;
    case 'Clubs':
      return <Club className={iconClass} fill="currentColor" />;
    case 'Spades':
      return <Spade className={iconClass} fill="currentColor" />;
  }
};

const getSuitColor = (suit: Card['suit']): string => {
  if (suit === 'Hearts' || suit === 'Diamonds') {
    return 'text-red-600 dark:text-red-500';
  }
  return 'text-slate-900 dark:text-slate-100';
};

export function PlayingCard({
  card,
  faceDown = false,
  deckColor = 'blue',
  onClick,
  disabled = false,
  selected = false,
  small = false,
  className,
}: PlayingCardProps) {
  const deckGradient = DECK_COLORS.find(d => d.value === deckColor)?.gradient || 'from-blue-600 to-blue-900';

  const baseSize = small ? 'w-14 h-20' : 'w-20 h-28';
  const fontSize = small ? 'text-xs' : 'text-sm';
  const iconSize = small ? 'w-3 h-3' : 'w-4 h-4';
  const centerIconSize = small ? 'w-6 h-6' : 'w-10 h-10';

  if (faceDown) {
    return (
      <div
        className={cn(
          baseSize,
          'rounded-lg shadow-lg border-2 border-white/20 dark:border-white/10',
          'bg-gradient-to-br',
          deckGradient,
          'flex items-center justify-center',
          'transition-transform duration-200',
          className
        )}
      >
        <div className="w-3/4 h-3/4 rounded border border-white/30 flex items-center justify-center">
          <div className="grid grid-cols-3 gap-0.5">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const suitColor = getSuitColor(card.suit);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseSize,
        'rounded-lg shadow-lg border border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-800',
        'flex flex-col relative',
        'transition-all duration-200',
        !disabled && 'cursor-pointer hover:-translate-y-2 hover:shadow-xl',
        disabled && 'opacity-50 cursor-not-allowed',
        selected && '-translate-y-4 ring-2 ring-primary shadow-xl',
        className
      )}
      data-testid={`card-${card.rank}-${card.suit}`}
    >
      <div className={cn('absolute top-1 left-1.5 flex flex-col items-center', suitColor)}>
        <span className={cn('font-bold leading-none', fontSize)}>{card.rank}</span>
        <SuitIcon suit={card.suit} className={iconSize} />
      </div>

      <div className={cn('flex-1 flex items-center justify-center', suitColor)}>
        <SuitIcon suit={card.suit} className={centerIconSize} />
      </div>

      <div className={cn('absolute bottom-1 right-1.5 flex flex-col items-center rotate-180', suitColor)}>
        <span className={cn('font-bold leading-none', fontSize)}>{card.rank}</span>
        <SuitIcon suit={card.suit} className={iconSize} />
      </div>
    </button>
  );
}

export function CardBack({ deckColor = 'blue', small = false, className }: { deckColor?: DeckColor; small?: boolean; className?: string }) {
  return <PlayingCard faceDown deckColor={deckColor} small={small} className={className} />;
}

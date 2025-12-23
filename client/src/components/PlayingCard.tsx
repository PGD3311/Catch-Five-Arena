import { Card, DeckColor, DECK_COLORS, Suit } from '@shared/gameTypes';
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
  trumpSuit?: Suit | null;
}

const SuitIcon = ({ suit, className }: { suit: Card['suit']; className?: string }) => {
  const iconClass = cn('drop-shadow-sm', className);
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
  trumpSuit,
}: PlayingCardProps) {
  const isTrump = card && trumpSuit && card.suit === trumpSuit;
  const deckGradient = DECK_COLORS.find(d => d.value === deckColor)?.gradient || 'from-blue-600 to-blue-900';

  const baseSize = small ? 'w-14 h-20' : 'w-20 h-28';
  const fontSize = small ? 'text-xs' : 'text-base';
  const iconSize = small ? 'w-3 h-3' : 'w-4 h-4';
  const centerIconSize = small ? 'w-6 h-6' : 'w-12 h-12';

  if (faceDown) {
    return (
      <div
        className={cn(
          baseSize,
          'rounded-xl relative overflow-hidden',
          'shadow-[0_4px_12px_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.15)]',
          'dark:shadow-[0_4px_16px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.3)]',
          'transform-gpu transition-transform duration-200',
          className
        )}
      >
        <div className={cn(
          'absolute inset-0 bg-gradient-to-br',
          deckGradient
        )} />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20" />
        <div className="absolute inset-[3px] rounded-lg border border-white/30 dark:border-white/20 flex items-center justify-center">
          <div className="w-3/4 h-3/4 rounded-md border border-white/20 bg-white/5 flex items-center justify-center backdrop-blur-[1px]">
            <div className="grid grid-cols-3 gap-1">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-white/50 rounded-full shadow-sm" />
              ))}
            </div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
      </div>
    );
  }

  if (!card) return null;

  const suitColor = getSuitColor(card.suit);
  const isRed = card.suit === 'Hearts' || card.suit === 'Diamonds';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseSize,
        'rounded-xl relative overflow-hidden group',
        'shadow-[0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]',
        'dark:shadow-[0_4px_16px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]',
        'bg-gradient-to-br from-white via-slate-50 to-slate-100',
        'dark:from-slate-800 dark:via-slate-850 dark:to-slate-900',
        'flex flex-col',
        'transform-gpu transition-all duration-200 ease-out',
        !disabled && 'cursor-pointer',
        !disabled && 'hover:-translate-y-3 hover:scale-[1.02] hover:shadow-[0_12px_28px_rgba(0,0,0,0.25),0_6px_12px_rgba(0,0,0,0.15)]',
        !disabled && 'dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.6),0_6px_16px_rgba(0,0,0,0.35)]',
        !disabled && 'active:translate-y-0 active:scale-[0.98] active:shadow-[0_2px_8px_rgba(0,0,0,0.2)]',
        disabled && 'opacity-40 cursor-not-allowed grayscale-[30%]',
        selected && '-translate-y-5 scale-[1.05] ring-2 ring-primary ring-offset-2 ring-offset-background shadow-[0_16px_40px_rgba(0,0,0,0.3)]',
        isTrump && !selected && 'ring-2 ring-amber-400 dark:ring-amber-500 ring-offset-2 ring-offset-background shadow-[0_0_20px_rgba(251,191,36,0.3)]',
        className
      )}
      data-testid={`card-${card.rank}-${card.suit}`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/5 dark:from-white/10 dark:to-black/20 pointer-events-none" />
      
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-slate-200/80 dark:ring-slate-600/50 pointer-events-none" />

      <div className={cn(
        'absolute top-1.5 left-2 flex flex-col items-center z-10',
        suitColor
      )}>
        <span className={cn(
          'font-bold leading-none tracking-tight',
          fontSize,
          'drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]'
        )}>
          {card.rank}
        </span>
        <SuitIcon suit={card.suit} className={iconSize} />
      </div>

      <div className={cn(
        'flex-1 flex items-center justify-center relative z-10',
        suitColor
      )}>
        <div className={cn(
          'relative',
          !disabled && 'group-hover:scale-110 transition-transform duration-200'
        )}>
          <SuitIcon suit={card.suit} className={cn(centerIconSize, 'drop-shadow-md')} />
          <div className={cn(
            'absolute inset-0 blur-md opacity-30',
            isRed ? 'bg-red-500' : 'bg-slate-600 dark:bg-slate-300'
          )} />
        </div>
      </div>

      <div className={cn(
        'absolute bottom-1.5 right-2 flex flex-col items-center rotate-180 z-10',
        suitColor
      )}>
        <span className={cn(
          'font-bold leading-none tracking-tight',
          fontSize,
          'drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]'
        )}>
          {card.rank}
        </span>
        <SuitIcon suit={card.suit} className={iconSize} />
      </div>

      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/30 to-transparent dark:from-white/5 pointer-events-none rounded-t-xl" />
    </button>
  );
}

export function CardBack({ deckColor = 'blue', small = false, className }: { deckColor?: DeckColor; small?: boolean; className?: string }) {
  return <PlayingCard faceDown deckColor={deckColor} small={small} className={className} />;
}

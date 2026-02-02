import { Card, DeckColor, DECK_COLORS, Suit } from '@shared/gameTypes';
import { cn } from '@/lib/utils';
import { getSuitColor, SuitIcon } from '@/components/ui/suit-utils';

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

export function PlayingCard({
  card,
  faceDown = false,
  deckColor = 'orange',
  onClick,
  disabled = false,
  selected = false,
  small = false,
  className,
  trumpSuit,
}: PlayingCardProps) {
  const isTrump = card && trumpSuit && card.suit === trumpSuit;
  const deckColorData = DECK_COLORS.find(d => d.value === deckColor);
  const cssGradient = deckColorData?.cssGradient || 'linear-gradient(135deg, #2563eb, #1e3a8a)';

  const baseSize = small ? 'w-12 h-[4.25rem] sm:w-14 sm:h-20' : 'w-16 h-[5.5rem] sm:w-20 sm:h-28 md:w-24 md:h-34';
  const fontSize = small ? 'text-xs' : 'text-xs sm:text-sm md:text-lg';
  const iconSize = small ? 'w-2.5 h-2.5 sm:w-3 sm:h-3' : 'w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5';
  const centerIconSize = small ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-6 h-6 sm:w-10 sm:h-10 md:w-14 md:h-14';

  if (faceDown) {
    return (
      <div
        className={cn(
          baseSize,
          'rounded-xl relative overflow-hidden',
          'shadow-[0_4px_12px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.2)]',
          'dark:shadow-[0_4px_16px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.3)]',
          'transform-gpu transition-transform duration-200',
          className
        )}
      >
        <div
          className="absolute inset-0"
          style={{ background: cssGradient }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-black/20" />
        <div className="absolute inset-[3px] rounded-lg border border-white/20 dark:border-white/15 flex items-center justify-center">
          <div className="w-3/4 h-3/4 rounded-md border border-white/15 bg-white/5 flex items-center justify-center">
            <div className="grid grid-cols-3 gap-1">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-white/40 rounded-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.08]" />
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
        'rounded-xl relative overflow-hidden group card-shimmer',
        'shadow-[0_4px_12px_rgba(0,0,0,0.2),0_2px_4px_rgba(0,0,0,0.1)]',
        'dark:shadow-[0_4px_16px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.25)]',
        'bg-gradient-to-br from-white via-slate-50 to-slate-100',
        'dark:from-[hsl(150_15%_14%)] dark:via-[hsl(150_12%_12%)] dark:to-[hsl(150_10%_10%)]',
        'flex flex-col',
        'transform-gpu transition-all duration-200 ease-out',
        !disabled && 'cursor-pointer',
        !disabled && 'hover:-translate-y-3 hover:scale-[1.02]',
        !disabled && 'hover:shadow-[0_12px_28px_rgba(0,0,0,0.3),0_6px_12px_rgba(0,0,0,0.2)]',
        !disabled && 'dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.6),0_6px_16px_rgba(0,0,0,0.35)]',
        !disabled && 'active:translate-y-0 active:scale-[0.98]',
        disabled && 'opacity-35 cursor-not-allowed grayscale-[30%]',
        selected && '-translate-y-5 scale-[1.05] ring-2 ring-[hsl(var(--gold))] ring-offset-2 ring-offset-background shadow-[0_0_24px_rgba(214,170,54,0.3)]',
        isTrump && !selected && 'ring-2 ring-[hsl(var(--gold)/0.6)] ring-offset-1 ring-offset-background shadow-[0_0_16px_hsl(var(--gold)/0.15)]',
        className
      )}
      data-testid={`card-${card.rank}-${card.suit}`}
    >
      {/* Face gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/5 dark:from-white/[0.06] dark:to-black/15 pointer-events-none" />

      {/* Inner rim */}
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-slate-200/60 dark:ring-white/[0.06] pointer-events-none" />

      {/* Top-left rank + suit */}
      <div className={cn(
        'absolute top-1.5 left-2 flex flex-col items-center z-10',
        suitColor
      )}>
        <span className={cn(
          'font-bold leading-none tracking-tight',
          fontSize,
          'drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
        )}>
          {card.rank}
        </span>
        <SuitIcon suit={card.suit} className={iconSize} />
      </div>

      {/* Center suit icon */}
      <div className={cn(
        'absolute inset-0 flex items-center justify-center z-10',
        suitColor
      )}>
        <div className={cn(
          'relative',
          !disabled && 'group-hover:scale-110 transition-transform duration-200'
        )}>
          <SuitIcon suit={card.suit} className={cn(centerIconSize, 'drop-shadow-md')} />
          <div className={cn(
            'absolute inset-0 blur-lg opacity-20',
            card.suit === 'Hearts' && 'bg-red-500',
            card.suit === 'Diamonds' && 'bg-blue-500',
            card.suit === 'Clubs' && 'bg-emerald-500',
            card.suit === 'Spades' && 'bg-slate-500 dark:bg-slate-300'
          )} />
        </div>
      </div>

      {/* Bottom-right rank + suit (rotated) */}
      <div className={cn(
        'absolute bottom-1.5 right-2 flex flex-col items-center rotate-180 z-10',
        suitColor
      )}>
        <span className={cn(
          'font-bold leading-none tracking-tight',
          fontSize,
          'drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
        )}>
          {card.rank}
        </span>
        <SuitIcon suit={card.suit} className={iconSize} />
      </div>

      {/* Top highlight */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white/20 to-transparent dark:from-white/[0.04] pointer-events-none rounded-t-xl" />
    </button>
  );
}

export function CardBack({ deckColor = 'orange', small = false, className }: { deckColor?: DeckColor; small?: boolean; className?: string }) {
  return <PlayingCard faceDown deckColor={deckColor} small={small} className={className} />;
}

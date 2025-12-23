import { useState, useRef, useCallback } from 'react';
import { Card as CardType, Suit } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface CardDockProps {
  cards: CardType[];
  onCardClick?: (card: CardType) => void;
  canPlayCard?: (card: CardType) => boolean;
  isCurrentPlayer: boolean;
  trumpSuit?: Suit | null;
}

export function CardDock({ cards, onCardClick, canPlayCard, isCurrentPlayer, trumpSuit }: CardDockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(Infinity);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
    }
  }, [mouseX]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(Infinity);
  }, [mouseX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && e.touches.length > 0) {
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(e.touches[0].clientX - rect.left);
    }
  }, [mouseX]);

  return (
    <div className="relative w-full pb-2">
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
      
      <div 
        ref={containerRef}
        className="relative z-10 overflow-x-auto overflow-y-visible scrollbar-hide"
        style={{ paddingLeft: 'max(env(safe-area-inset-left), 2rem)', paddingRight: 'max(env(safe-area-inset-right), 2rem)' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseLeave}
      >
        <div className="flex items-end justify-center gap-1 px-16 py-2 min-w-min">
          <AnimatePresence mode="popLayout">
            {cards.map((card, index) => (
              <DockCard
                key={card.id}
                card={card}
                index={index}
                mouseX={mouseX}
                containerRef={containerRef}
                onClick={() => onCardClick?.(card)}
                disabled={!(canPlayCard ? canPlayCard(card) : true) || !isCurrentPlayer}
                trumpSuit={trumpSuit}
                totalCards={cards.length}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface DockCardProps {
  card: CardType;
  index: number;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  containerRef: React.RefObject<HTMLDivElement>;
  onClick?: () => void;
  disabled: boolean;
  trumpSuit?: Suit | null;
  totalCards: number;
}

function DockCard({ card, index, mouseX, containerRef, onClick, disabled, trumpSuit, totalCards }: DockCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  const distance = useTransform(mouseX, (val: number) => {
    if (!ref.current || val === Infinity) return 150;
    const bounds = ref.current.getBoundingClientRect();
    const containerBounds = containerRef.current?.getBoundingClientRect();
    if (!containerBounds) return 150;
    
    const cardCenterX = bounds.left - containerBounds.left + bounds.width / 2;
    return Math.abs(val - cardCenterX);
  });

  const baseWidth = 64;
  const maxWidth = 88;
  const magnificationRange = 120;
  
  const widthSync = useTransform(distance, [0, magnificationRange], [maxWidth, baseWidth]);
  const width = useSpring(widthSync, { stiffness: 400, damping: 30, mass: 0.5 });
  
  const heightSync = useTransform(distance, [0, magnificationRange], [maxWidth * 1.4, baseWidth * 1.4]);
  const height = useSpring(heightSync, { stiffness: 400, damping: 30, mass: 0.5 });
  
  const ySync = useTransform(distance, [0, magnificationRange], [-12, 0]);
  const y = useSpring(ySync, { stiffness: 400, damping: 30, mass: 0.5 });

  const isTrump = trumpSuit && card.suit === trumpSuit;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5, y: -30 }}
      style={{ width, height, y }}
      className="relative flex-shrink-0"
    >
      <motion.button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'w-full h-full rounded-xl relative overflow-hidden',
          'shadow-[0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]',
          'dark:shadow-[0_4px_16px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]',
          'bg-gradient-to-br from-white via-slate-50 to-slate-100',
          'dark:from-slate-800 dark:via-slate-850 dark:to-slate-900',
          'transform-gpu transition-shadow duration-200',
          !disabled && 'cursor-pointer',
          !disabled && 'hover:shadow-[0_12px_28px_rgba(0,0,0,0.25),0_6px_12px_rgba(0,0,0,0.15)]',
          disabled && 'opacity-40 cursor-not-allowed grayscale-[30%]',
          isTrump && 'ring-2 ring-amber-400 dark:ring-amber-500 ring-offset-2 ring-offset-background'
        )}
        data-testid={`card-${card.rank}-${card.suit}`}
      >
        <CardContent card={card} />
      </motion.button>
    </motion.div>
  );
}

function CardContent({ card }: { card: CardType }) {
  const suitColor = getSuitColor(card.suit);
  
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/5 dark:from-white/10 dark:to-black/20 pointer-events-none" />
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-slate-200/80 dark:ring-slate-600/50 pointer-events-none" />

      <div className={cn('absolute top-1 left-1.5 flex flex-col items-center z-10', suitColor)}>
        <span className="text-[10px] sm:text-xs font-bold leading-none">{card.rank}</span>
        <SuitIcon suit={card.suit} className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
      </div>

      <div className={cn('flex-1 flex items-center justify-center', suitColor)}>
        <SuitIcon suit={card.suit} className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-md" />
      </div>

      <div className={cn('absolute bottom-1 right-1.5 flex flex-col items-center rotate-180 z-10', suitColor)}>
        <span className="text-[10px] sm:text-xs font-bold leading-none">{card.rank}</span>
        <SuitIcon suit={card.suit} className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
      </div>
    </div>
  );
}

import { Heart, Diamond, Club, Spade } from 'lucide-react';

function SuitIcon({ suit, className }: { suit: CardType['suit']; className?: string }) {
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
}

function getSuitColor(suit: CardType['suit']): string {
  switch (suit) {
    case 'Hearts':
      return 'text-red-600 dark:text-red-500';
    case 'Diamonds':
      return 'text-blue-600 dark:text-blue-400';
    case 'Clubs':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'Spades':
      return 'text-slate-900 dark:text-slate-100';
  }
}

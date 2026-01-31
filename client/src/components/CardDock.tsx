import { useState, useRef, useCallback, useEffect } from 'react';
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

  // Detect if scrollable for edge fade hints
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  const checkScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  }, []);

  // Check scroll on mount and when cards change
  useEffect(() => {
    checkScroll();
    // Small delay to ensure layout is complete
    const timer = setTimeout(checkScroll, 100);
    return () => clearTimeout(timer);
  }, [cards.length, checkScroll]);

  return (
    <div className="relative w-full pb-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}>
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
      
      {/* Left edge fade - scroll hint */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none z-20 transition-opacity duration-200",
        canScrollLeft ? "opacity-100" : "opacity-0"
      )} />
      
      {/* Right edge fade - scroll hint */}
      <div className={cn(
        "absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none z-20 transition-opacity duration-200",
        canScrollRight ? "opacity-100" : "opacity-0"
      )} />
      
      <div 
        ref={containerRef}
        className="relative z-10 overflow-x-auto overflow-y-visible scrollbar-hide"
        style={{ 
          paddingLeft: 'max(env(safe-area-inset-left), 1.5rem)', 
          paddingRight: 'max(env(safe-area-inset-right), 1.5rem)' 
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseLeave}
        onScroll={checkScroll}
        onLoad={checkScroll}
      >
        <div className="flex items-end justify-center px-6 sm:px-4 py-2 min-w-fit mx-auto" style={{ gap: cards.length > 8 ? '-4px' : '2px' }}>
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

  // Adaptive sizing based on card count - larger for fewer cards, bigger on mobile for touch
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const mobileBoost = isMobile ? 6 : 0;
  const baseWidth = (totalCards <= 4 ? 58 : totalCards <= 6 ? 52 : totalCards <= 8 ? 46 : 42) + mobileBoost;
  const maxWidth = (totalCards <= 4 ? 72 : totalCards <= 6 ? 66 : totalCards <= 8 ? 58 : 52) + mobileBoost;
  const magnificationRange = isMobile ? 70 : 80;
  
  const springConfig = { stiffness: 350, damping: 28, mass: 0.4 }; // Smoother spring
  
  const widthSync = useTransform(distance, [0, magnificationRange], [maxWidth, baseWidth]);
  const width = useSpring(widthSync, springConfig);
  
  const heightSync = useTransform(distance, [0, magnificationRange], [maxWidth * 1.4, baseWidth * 1.4]);
  const height = useSpring(heightSync, springConfig);
  
  const ySync = useTransform(distance, [0, magnificationRange], [-16, 0]); // More lift on hover
  const y = useSpring(ySync, springConfig);
  
  // Z-index increases toward center and on hover for proper stacking
  const zIndexSync = useTransform(distance, [0, magnificationRange], [30, 10]);
  const baseZIndex = 10 + index; // Cards stack left-to-right
  
  // Subtle fan tilt - just a hint of natural hand feel
  const centerIndex = (totalCards - 1) / 2;
  const offsetFromCenter = index - centerIndex;
  const maxTilt = 2; // Very subtle tilt
  const baseTilt = (offsetFromCenter / Math.max(centerIndex, 1)) * maxTilt;
  
  // Reduce tilt on hover for focused card
  const tiltSync = useTransform(distance, [0, magnificationRange], [0, baseTilt]);
  const tilt = useSpring(tiltSync, springConfig);

  const isTrump = trumpSuit && card.suit === trumpSuit;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.8, y: 20, rotate: baseTilt }}
      animate={{ opacity: 1, scale: 1, rotate: baseTilt }}
      exit={{ opacity: 0, scale: 0.5, y: -30 }}
      style={{ width, height, y, zIndex: baseZIndex, rotate: tilt }}
      whileHover={{ zIndex: 40, rotate: 0 }}
      className="relative flex-shrink-0 origin-bottom"
    >
      <motion.button
        onClick={onClick}
        disabled={disabled}
        whileTap={!disabled ? { scale: 1.15, y: -8, zIndex: 50, rotate: 0 } : undefined}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={cn(
          'w-full h-full rounded-lg relative overflow-hidden',
          'shadow-[0_4px_12px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]',
          'dark:shadow-[0_6px_16px_rgba(0,0,0,0.4),0_3px_6px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.05)]',
          'bg-gradient-to-br from-white via-slate-50 to-slate-100',
          'dark:from-slate-800 dark:via-slate-850 dark:to-slate-900',
          'transform-gpu transition-all duration-150',
          !disabled && 'cursor-pointer',
          !disabled && 'hover:shadow-[0_12px_28px_rgba(0,0,0,0.25),0_8px_12px_rgba(0,0,0,0.15)] hover:brightness-105',
          !disabled && 'active:shadow-[0_18px_36px_rgba(0,0,0,0.3),0_10px_18px_rgba(0,0,0,0.2)]',
          disabled && 'opacity-40 cursor-not-allowed grayscale-[30%]',
          isTrump && 'ring-2 ring-amber-400 dark:ring-amber-500 ring-offset-1 ring-offset-background'
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
      {/* Card face gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60 dark:from-slate-700 dark:via-slate-800/90 dark:to-slate-900 pointer-events-none" />
      {/* Rim light effect */}
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/60 dark:ring-white/10 pointer-events-none" />

      {/* Top-left rank/suit */}
      <div className={cn('absolute top-1 left-1.5 flex flex-col items-center z-10', suitColor)}>
        <span className="text-xs sm:text-sm font-bold leading-none drop-shadow-sm">{card.rank}</span>
        <SuitIcon suit={card.suit} className="w-2 h-2 sm:w-2.5 sm:h-2.5 opacity-90" />
      </div>

      {/* Center suit icon */}
      <div className={cn('flex-1 flex items-center justify-center', suitColor)}>
        <SuitIcon suit={card.suit} className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-md" />
      </div>

      {/* Bottom-right rank/suit (rotated) */}
      <div className={cn('absolute bottom-1 right-1.5 flex flex-col items-center rotate-180 z-10', suitColor)}>
        <span className="text-xs sm:text-sm font-bold leading-none drop-shadow-sm">{card.rank}</span>
        <SuitIcon suit={card.suit} className="w-2 h-2 sm:w-2.5 sm:h-2.5 opacity-90" />
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
      return 'text-red-500 dark:text-red-400';
    case 'Diamonds':
      return 'text-blue-500 dark:text-blue-400';
    case 'Clubs':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'Spades':
      return 'text-slate-800 dark:text-slate-100';
  }
}

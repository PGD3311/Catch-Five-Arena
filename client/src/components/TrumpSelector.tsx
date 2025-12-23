import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Suit, SUITS } from '@shared/gameTypes';
import { Heart, Diamond, Club, Spade } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrumpSelectorProps {
  open: boolean;
  onSelect: (suit: Suit) => void;
}

const suitConfig = {
  Hearts: { Icon: Heart, color: 'text-red-500', bgHover: 'hover:bg-red-50 dark:hover:bg-red-950/30' },
  Diamonds: { Icon: Diamond, color: 'text-red-500', bgHover: 'hover:bg-red-50 dark:hover:bg-red-950/30' },
  Clubs: { Icon: Club, color: 'text-slate-900 dark:text-slate-100', bgHover: 'hover:bg-slate-100 dark:hover:bg-slate-800' },
  Spades: { Icon: Spade, color: 'text-slate-900 dark:text-slate-100', bgHover: 'hover:bg-slate-100 dark:hover:bg-slate-800' },
};

export function TrumpSelector({ open, onSelect }: TrumpSelectorProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Select Trump Suit</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-6">
          {SUITS.map((suit) => {
            const { Icon, color, bgHover } = suitConfig[suit];
            return (
              <Button
                key={suit}
                variant="outline"
                onClick={() => onSelect(suit)}
                className={cn(
                  'h-28 flex flex-col items-center justify-center gap-2',
                  bgHover,
                  'border-2 transition-all'
                )}
                data-testid={`button-trump-${suit.toLowerCase()}`}
              >
                <Icon className={cn('w-12 h-12', color)} fill="currentColor" />
                <span className="text-lg font-semibold">{suit}</span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

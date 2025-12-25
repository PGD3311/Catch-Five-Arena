import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card as CardType, DeckColor, DECK_COLORS } from '@shared/gameTypes';
import { Moon } from 'lucide-react';

interface SleptCardsModalProps {
  open: boolean;
  onClose: () => void;
  sleptCards: CardType[];
  deckColor: DeckColor;
}

const getSuitColor = (suit: string) => {
  switch (suit) {
    case 'Hearts': return 'text-red-500';
    case 'Diamonds': return 'text-blue-500';
    case 'Clubs': return 'text-emerald-500';
    case 'Spades': return 'text-slate-400 dark:text-slate-300';
    default: return '';
  }
};

const getSuitSymbol = (suit: string) => {
  switch (suit) {
    case 'Hearts': return '\u2665';
    case 'Diamonds': return '\u2666';
    case 'Clubs': return '\u2663';
    case 'Spades': return '\u2660';
    default: return '';
  }
};

export function SleptCardsModal({ open, onClose, sleptCards, deckColor }: SleptCardsModalProps) {
  const deckColorConfig = DECK_COLORS.find(c => c.value === deckColor);
  const cardBack = deckColorConfig?.cssGradient || 'linear-gradient(135deg, #2563eb, #1e3a8a)';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-muted-foreground" />
            Slept Cards ({sleptCards.length})
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            These cards were not dealt out and are not in play this round.
          </p>
          
          {sleptCards.length === 0 ? (
            <div className="text-center py-8">
              <div 
                className="w-16 h-24 rounded-md mx-auto mb-3 flex items-center justify-center"
                style={{ background: cardBack }}
              >
                <span className="text-2xl text-white/70">Z</span>
              </div>
              <p className="text-sm text-muted-foreground">All cards were dealt</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {sleptCards.map((card) => (
                <div
                  key={card.id}
                  className="aspect-[2.5/3.5] rounded-md border bg-card flex flex-col items-center justify-center p-1 shadow-sm"
                  data-testid={`slept-card-${card.id}`}
                >
                  <span className={`text-lg font-bold ${getSuitColor(card.suit)}`}>
                    {card.rank}
                  </span>
                  <span className={`text-xl ${getSuitColor(card.suit)}`}>
                    {getSuitSymbol(card.suit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

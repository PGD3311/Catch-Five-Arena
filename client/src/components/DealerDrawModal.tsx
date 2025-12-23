import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Player, DealerDrawCard, RANK_ORDER_ACE_LOW, Card } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';
import { Crown } from 'lucide-react';
import { useEffect, useState } from 'react';

const SUIT_ORDER: Record<string, number> = {
  'Clubs': 0,
  'Diamonds': 1,
  'Hearts': 2,
  'Spades': 3,
};

const getDealerDrawValue = (card: Card): number => {
  const rankValue = RANK_ORDER_ACE_LOW[card.rank];
  const suitValue = SUIT_ORDER[card.suit];
  return rankValue * 10 + suitValue;
};

interface DealerDrawModalProps {
  open: boolean;
  players: Player[];
  dealerDrawCards: DealerDrawCard[];
  onComplete: () => void;
  deckColor: string;
}

export function DealerDrawModal({ open, players, dealerDrawCards, onComplete, deckColor }: DealerDrawModalProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!open) {
      setRevealedCount(0);
      setShowResult(false);
      return;
    }

    if (revealedCount < 4) {
      const timer = setTimeout(() => {
        setRevealedCount(prev => prev + 1);
      }, 600);
      return () => clearTimeout(timer);
    } else if (!showResult) {
      const timer = setTimeout(() => {
        setShowResult(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [open, revealedCount, showResult]);

  let lowestIndex = 0;
  if (dealerDrawCards.length > 0) {
    let lowestValue = getDealerDrawValue(dealerDrawCards[0].card);
    for (let i = 1; i < dealerDrawCards.length; i++) {
      const cardValue = getDealerDrawValue(dealerDrawCards[i].card);
      if (cardValue < lowestValue) {
        lowestValue = cardValue;
        lowestIndex = i;
      }
    }
  }

  const dealerPlayer = players[lowestIndex];

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Drawing for Dealer
          </DialogTitle>
          <DialogDescription className="text-center">
            Low card deals first
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {players.map((player, index) => {
              const drawCard = dealerDrawCards[index];
              const isRevealed = index < revealedCount;
              const isDealer = showResult && index === lowestIndex;

              return (
                <div
                  key={player.id}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg transition-all',
                    isDealer && 'bg-primary/10 ring-2 ring-primary'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isDealer && <Crown className="w-4 h-4 text-primary" />}
                    <span className={cn('font-medium', isDealer && 'text-primary')}>
                      {player.name}
                    </span>
                  </div>
                  
                  <div className={cn(
                    'transition-all duration-300',
                    isRevealed ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                  )}>
                    {drawCard && (
                      <PlayingCard
                        card={isRevealed ? drawCard.card : undefined}
                        faceDown={!isRevealed}
                        deckColor={deckColor as any}
                        small
                      />
                    )}
                  </div>

                  {isRevealed && drawCard && (
                    <span className="text-sm text-muted-foreground">
                      {drawCard.card.rank} of {drawCard.card.suit}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {showResult && (
            <div className="text-center space-y-4">
              <p className="text-lg font-medium">
                <span className="text-primary">{dealerPlayer?.name}</span> draws lowest and will deal!
              </p>
              <Button onClick={onComplete} data-testid="button-start-dealing">
                Start Dealing
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

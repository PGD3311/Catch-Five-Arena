import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Player, Suit, Card } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';
import { ArrowDown, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PurgeDrawModalProps {
  open: boolean;
  players: Player[];
  trumpSuit: Suit;
  onComplete: () => void;
  localPlayerId?: string;
}

export function PurgeDrawModal({ open, players, trumpSuit, onComplete, localPlayerId }: PurgeDrawModalProps) {
  const [step, setStep] = useState<'purge' | 'draw' | 'done'>('purge');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep('purge');
      setCurrentPlayerIndex(0);
      return;
    }

    const timer = setTimeout(() => {
      if (step === 'purge') {
        if (currentPlayerIndex < players.length - 1) {
          setCurrentPlayerIndex(prev => prev + 1);
        } else {
          setStep('draw');
          setCurrentPlayerIndex(0);
        }
      } else if (step === 'draw') {
        if (currentPlayerIndex < players.length - 1) {
          setCurrentPlayerIndex(prev => prev + 1);
        } else {
          setStep('done');
          setTimeout(onComplete, 4000);
        }
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [open, step, currentPlayerIndex, players.length, onComplete]);

  const currentPlayer = players[currentPlayerIndex];

  const getSuitIcon = (suit: Suit) => {
    const icons = {
      Hearts: '♥',
      Diamonds: '♦',
      Clubs: '♣',
      Spades: '♠',
    };
    return icons[suit];
  };

  const getSuitColor = (suit: Suit) => {
    switch (suit) {
      case 'Hearts': return 'text-red-500';
      case 'Diamonds': return 'text-blue-500';
      case 'Clubs': return 'text-emerald-500';
      case 'Spades': return 'text-foreground';
    }
  };

  const getTrumpCount = (player: Player) => {
    if (player.trumpCount !== undefined) {
      return player.trumpCount;
    }
    return player.hand.filter(c => c.suit === trumpSuit).length;
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            {step === 'purge' ? (
              <>
                <Trash2 className="w-5 h-5 text-destructive" />
                Discarding Non-Trumps
              </>
            ) : step === 'draw' ? (
              <>
                <ArrowDown className="w-5 h-5 text-primary" />
                Drawing Cards
              </>
            ) : (
              'Ready to Play!'
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-4">
          <div className={cn(
            'flex items-center justify-center gap-2 text-2xl font-bold',
            getSuitColor(trumpSuit)
          )}>
            <span>Trump:</span>
            <span>{getSuitIcon(trumpSuit)} {trumpSuit}</span>
          </div>

          <div className="space-y-3">
            {players.map((player, index) => {
              const isActive = index === currentPlayerIndex;
              const isPast = index < currentPlayerIndex;
              const trumpCount = getTrumpCount(player);
              const status = step === 'purge' 
                ? (isPast ? 'Discarded non-trumps' : isActive ? 'Discarding...' : '')
                : step === 'draw'
                ? (isPast ? 'Drew to 6 cards' : isActive ? 'Drawing...' : '')
                : 'Ready!';

              const isLocalPlayer = player.id === localPlayerId || player.isHuman;
              // Only show trump count during purge phase to avoid revealing post-draw counts
              const showTrumpCount = isLocalPlayer && step === 'purge';
              
              return (
                <div
                  key={player.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg transition-all',
                    isActive && 'bg-primary/10 ring-1 ring-primary',
                    isPast && 'bg-muted/50',
                    !isActive && !isPast && 'opacity-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{player.name}</span>
                    {showTrumpCount && (
                      <span className={cn(
                        'text-sm font-bold px-2 py-0.5 rounded-full',
                        getSuitColor(trumpSuit),
                        'bg-muted'
                      )} data-testid={`trump-count-${player.id}`}>
                        {trumpCount} {getSuitIcon(trumpSuit)}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    'text-sm',
                    isActive && 'text-primary animate-pulse',
                    isPast && 'text-muted-foreground'
                  )}>
                    {status}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            All non-trump cards are discarded, then each player draws back to 6 cards
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

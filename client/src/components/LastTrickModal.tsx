import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrickCard, Player, Suit } from '@shared/gameTypes';
import { PlayingCard } from './PlayingCard';
import { Trophy } from 'lucide-react';

interface LastTrickModalProps {
  open: boolean;
  onClose: () => void;
  lastTrick: TrickCard[];
  players: Player[];
  winnerId: string | null;
  trumpSuit: Suit | null;
}

export function LastTrickModal({ open, onClose, lastTrick, players, winnerId, trumpSuit }: LastTrickModalProps) {
  const winner = players.find(p => p.id === winnerId);
  
  const getPlayerName = (playerId: string): string => {
    return players.find(p => p.id === playerId)?.name || '';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Last Trick</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {winner && (
            <div className="flex items-center justify-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-amber-400">{winner.name} won</span>
            </div>
          )}

          <div className="flex justify-center gap-3 flex-wrap">
            {lastTrick.map((trickCard) => (
              <div key={trickCard.card.id} className="flex flex-col items-center gap-2">
                <PlayingCard card={trickCard.card} trumpSuit={trumpSuit} />
                <span className="text-xs text-muted-foreground font-medium">
                  {getPlayerName(trickCard.playerId)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={onClose} className="w-full" data-testid="button-close-last-trick">
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}

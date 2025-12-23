import { GameState, Player } from '@shared/gameTypes';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ActionPromptProps {
  gameState: GameState;
}

export function ActionPrompt({ gameState }: ActionPromptProps) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const bidder = gameState.players.find(p => p.id === gameState.bidderId);
  
  const getMessage = (): { text: string; isWaiting: boolean } => {
    switch (gameState.phase) {
      case 'bidding':
        if (currentPlayer.isHuman) {
          return { 
            text: gameState.highBid > 0 ? `Beat ${gameState.highBid} or pass` : 'Open bidding', 
            isWaiting: false
          };
        }
        return { text: `${currentPlayer.name} thinking...`, isWaiting: true };
      
      case 'trump-selection':
        return { text: 'Choose trump', isWaiting: false };
      
      case 'playing':
        if (currentPlayer.isHuman) {
          if (gameState.currentTrick.length === 0) {
            return { text: 'Your lead', isWaiting: false };
          }
          return { text: 'Your turn', isWaiting: false };
        }
        return { text: `${currentPlayer.name}...`, isWaiting: true };
      
      default:
        return { text: '', isWaiting: false };
    }
  };

  const { text, isWaiting } = getMessage();

  if (!text) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={text}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.2 }}
        className="text-center"
        data-testid="action-prompt"
        aria-live="polite"
        role="status"
      >
        <span className={cn(
          'text-xs font-medium tracking-wide',
          isWaiting ? 'text-muted-foreground/60' : 'text-foreground/80'
        )}>
          {text}
        </span>
        {isWaiting && (
          <span className="sr-only"> is thinking</span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

interface BidAnnouncementProps {
  player: Player;
  bid: number | null;
  isDealer: boolean;
}

export function BidAnnouncement({ player, bid, isDealer }: BidAnnouncementProps) {
  if (bid === null) return null;
  
  const message = bid === 0 ? 'Pass' : `Bid ${bid}`;
  
  return (
    <Badge 
      variant={bid > 0 ? 'default' : 'secondary'}
      className="text-xs"
      data-testid={`bid-announcement-${player.id}`}
    >
      {message}
    </Badge>
  );
}

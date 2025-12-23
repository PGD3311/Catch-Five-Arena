import { GameState, Player } from '@shared/gameTypes';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2, Hand, Crown, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActionPromptProps {
  gameState: GameState;
}

export function ActionPrompt({ gameState }: ActionPromptProps) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const dealer = gameState.players[gameState.dealerIndex];
  const bidder = gameState.players.find(p => p.id === gameState.bidderId);
  
  const getMessage = (): { text: string; isWaiting: boolean; icon: 'hand' | 'crown' | 'zap' | 'loader' } => {
    switch (gameState.phase) {
      case 'bidding':
        if (currentPlayer.isHuman) {
          return { 
            text: gameState.highBid > 0 ? `Beat ${gameState.highBid} or pass` : 'Open the bidding (5-9)', 
            isWaiting: false,
            icon: 'crown'
          };
        }
        return { text: `${currentPlayer.name} is thinking...`, isWaiting: true, icon: 'loader' };
      
      case 'trump-selection':
        return { text: 'Victory! Now choose your trump suit', isWaiting: false, icon: 'crown' };
      
      case 'playing':
        if (currentPlayer.isHuman) {
          if (gameState.currentTrick.length === 0) {
            return { text: 'Your lead! Play any card', isWaiting: false, icon: 'zap' };
          }
          return { text: 'Your turn - select a card', isWaiting: false, icon: 'hand' };
        }
        return { text: `${currentPlayer.name} is playing...`, isWaiting: true, icon: 'loader' };
      
      default:
        return { text: '', isWaiting: false, icon: 'hand' };
    }
  };

  const { text, isWaiting, icon } = getMessage();

  if (!text) return null;

  const IconComponent = {
    hand: Hand,
    crown: Crown,
    zap: Zap,
    loader: Loader2
  }[icon];

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={text}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          'flex items-center justify-center gap-3 px-6 py-3 rounded-xl',
          isWaiting 
            ? 'bg-muted/60 border border-border/50' 
            : 'bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30',
          'backdrop-blur-sm shadow-lg'
        )}
        data-testid="action-prompt"
      >
        <IconComponent className={cn(
          'w-5 h-5',
          isWaiting ? 'text-muted-foreground' : 'text-primary',
          icon === 'loader' && 'animate-spin'
        )} />
        <span className={cn(
          'text-sm font-semibold',
          !isWaiting && 'text-primary'
        )}>
          {text}
        </span>
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

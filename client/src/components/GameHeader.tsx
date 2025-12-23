import { GameState, Suit, Team } from '@shared/gameTypes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, Heart, Diamond, Club, Spade, Users, Share2, HelpCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface GameHeaderProps {
  gameState: GameState;
  onSettingsClick: () => void;
  onShareClick: () => void;
  onRulesClick: () => void;
}

const SuitDisplay = ({ suit }: { suit: Suit }) => {
  const isRed = suit === 'Hearts' || suit === 'Diamonds';
  const color = isRed ? 'text-red-500' : 'text-foreground';

  const Icon = {
    Hearts: Heart,
    Diamonds: Diamond,
    Clubs: Club,
    Spades: Spade,
  }[suit];

  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn('flex items-center gap-1.5', color)}
    >
      <Icon className="w-5 h-5 drop-shadow-[0_0_4px_currentColor]" fill="currentColor" />
      <span className="font-bold text-sm">{suit}</span>
    </motion.div>
  );
};

const getPhaseLabel = (phase: GameState['phase'], trickNumber: number): string => {
  switch (phase) {
    case 'setup':
      return 'Ready to Start';
    case 'dealer-draw':
      return 'Determining Dealer';
    case 'dealing':
      return 'Dealing Cards...';
    case 'bidding':
      return 'Bidding Phase';
    case 'trump-selection':
      return 'Select Trump';
    case 'purge-draw':
      return 'Purge & Draw';
    case 'playing':
      return `Trick ${Math.min(trickNumber, 6)} of 6`;
    case 'scoring':
      return 'Round Complete';
    case 'game-over':
      return 'Game Over';
    default:
      return '';
  }
};

const TeamScoreDisplay = ({ team, isYourTeam, targetScore }: { team: Team; isYourTeam: boolean; targetScore: number }) => {
  const progress = Math.min((team.score / targetScore) * 100, 100);
  
  return (
    <div 
      className={cn(
        'relative flex items-center gap-3 px-4 py-2 rounded-xl overflow-hidden',
        isYourTeam 
          ? 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 border border-blue-500/30' 
          : 'bg-gradient-to-r from-rose-500/20 to-rose-600/10 border border-rose-500/30'
      )}
      data-testid={`team-score-${team.id}`}
    >
      <div 
        className={cn(
          'absolute inset-0 opacity-20',
          isYourTeam ? 'bg-blue-500' : 'bg-rose-500'
        )}
        style={{ width: `${progress}%`, transition: 'width 0.5s ease-out' }}
      />
      <div className="relative flex items-center gap-2">
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center',
          isYourTeam ? 'bg-blue-500/30' : 'bg-rose-500/30'
        )}>
          <Users className="w-3 h-3" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{team.name}</span>
          <div className="flex items-baseline gap-1">
            <motion.span 
              key={team.score}
              initial={{ scale: 1.2, color: isYourTeam ? '#3b82f6' : '#f43f5e' }}
              animate={{ scale: 1, color: 'inherit' }}
              className="text-xl font-bold"
            >
              {team.score}
            </motion.span>
            <span className="text-xs text-muted-foreground">/{targetScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export function GameHeader({ gameState, onSettingsClick, onShareClick, onRulesClick }: GameHeaderProps) {
  const phaseLabel = getPhaseLabel(gameState.phase, gameState.trickNumber);
  const yourTeam = gameState.teams.find(t => t.id === 'team1');
  const opponentTeam = gameState.teams.find(t => t.id === 'team2');
  const isPlaying = gameState.phase === 'playing';

  return (
    <header className="flex items-center justify-between gap-4 p-3 border-b bg-gradient-to-r from-card via-card to-card/80 backdrop-blur-sm" data-testid="game-header">
      <div className="flex items-center gap-3 flex-wrap">
        <motion.div
          key={phaseLabel}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Badge 
            variant="secondary" 
            className={cn(
              "text-sm font-semibold px-4 py-1.5",
              isPlaying && "bg-primary/20 text-primary border border-primary/30"
            )} 
            data-testid="badge-phase"
          >
            {isPlaying && <Zap className="w-3 h-3 mr-1.5" />}
            {phaseLabel}
          </Badge>
        </motion.div>

        {gameState.highBid > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Badge variant="outline" className="text-sm px-3 py-1.5 border-amber-500/50 text-amber-400" data-testid="badge-high-bid">
              Bid: {gameState.highBid}
            </Badge>
          </motion.div>
        )}

        {gameState.trumpSuit && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30" 
            data-testid="display-trump-suit"
          >
            <span className="text-xs text-amber-300/80 font-medium">Trump:</span>
            <SuitDisplay suit={gameState.trumpSuit} />
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {yourTeam && gameState.phase !== 'setup' && (
          <TeamScoreDisplay team={yourTeam} isYourTeam targetScore={gameState.targetScore} />
        )}
        {opponentTeam && gameState.phase !== 'setup' && (
          <TeamScoreDisplay team={opponentTeam} isYourTeam={false} targetScore={gameState.targetScore} />
        )}

        <div className="flex items-center gap-1 ml-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onShareClick}
            data-testid="button-share"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onRulesClick}
            data-testid="button-rules"
            title="Rules"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onSettingsClick}
            data-testid="button-settings"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

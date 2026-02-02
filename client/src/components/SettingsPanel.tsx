import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DeckColor, DECK_COLORS } from '@shared/gameTypes';
import { cn } from '@/lib/utils';
import { RefreshCw, HelpCircle, User, Bot, LogOut, Volume2, VolumeX } from 'lucide-react';
import { useSound } from '@/hooks/useSoundEffects';
import { motion } from 'framer-motion';

interface PlayerConfig {
  id: string;
  name: string;
  isHuman: boolean;
}

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  deckColor: DeckColor;
  onDeckColorChange: (color: DeckColor) => void;
  onNewGame: () => void;
  onExitGame: () => void;
  onShowRules: () => void;
  playerConfigs: PlayerConfig[];
  onTogglePlayerType: (playerId: string) => void;
  onPlayerNameChange: (playerId: string, name: string) => void;
}

const GoldDivider = () => (
  <div
    className="h-px w-full my-1"
    style={{
      background: 'linear-gradient(90deg, transparent, hsl(42 82% 58% / 0.4), hsl(42 90% 72% / 0.6), hsl(42 82% 58% / 0.4), transparent)',
    }}
  />
);

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, x: 12 },
  show: { opacity: 1, x: 0 },
};

export function SettingsPanel({
  open,
  onClose,
  deckColor,
  onDeckColorChange,
  onNewGame,
  onExitGame,
  onShowRules,
  playerConfigs,
  onTogglePlayerType,
  onPlayerNameChange,
}: SettingsPanelProps) {
  const teamLabels = ['Your Team', 'Opponents', 'Your Team', 'Opponents'];
  const seatLabels = ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'];
  const { isMuted, toggleMute, playSound } = useSound();

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-80 bg-card/95 backdrop-blur-xl border-l border-[hsl(var(--gold-dim)/0.15)]">
        <SheetHeader>
          <SheetTitle className="gold-text text-lg" style={{ fontFamily: 'var(--font-display)' }}>
            Settings
          </SheetTitle>
          <GoldDivider />
        </SheetHeader>

        <motion.div
          className="space-y-6 py-6"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={item} className="space-y-3">
            <Label
              className="text-sm font-medium text-[hsl(var(--gold))] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Players
            </Label>
            <div className="space-y-2">
              {playerConfigs.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-card/50 border border-border/30"
                  data-testid={`player-config-${player.id}`}
                >
                  <button
                    onClick={() => onTogglePlayerType(player.id)}
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                      player.isHuman
                        ? index === 0 || index === 2
                          ? 'bg-[hsl(var(--team-blue)/0.2)] text-[hsl(var(--team-blue))]'
                          : 'bg-[hsl(var(--team-red)/0.2)] text-[hsl(var(--team-red))]'
                        : 'bg-muted text-muted-foreground'
                    )}
                    data-testid={`toggle-player-${player.id}`}
                  >
                    {player.isHuman ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    {player.isHuman ? (
                      <Input
                        placeholder="Name"
                        value={player.name}
                        onChange={(e) => onPlayerNameChange(player.id, e.target.value)}
                        className="h-8 text-sm"
                        data-testid={`input-player-name-${player.id}`}
                      />
                    ) : (
                      <div className="h-8 flex items-center px-3 text-sm text-muted-foreground">
                        CPU
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground text-right shrink-0 w-16">
                    <div>{seatLabels[index]}</div>
                    <div className={cn(
                      index === 0 || index === 2
                        ? 'text-[hsl(var(--team-blue))]'
                        : 'text-[hsl(var(--team-red))]'
                    )}>
                      {teamLabels[index]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Tap the icon to toggle Human/CPU
            </p>
          </motion.div>

          <GoldDivider />

          <motion.div variants={item} className="space-y-3">
            <Label
              className="text-sm font-medium text-[hsl(var(--gold))] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Sound Effects
            </Label>
            <div className="flex items-center justify-between p-2 rounded-xl bg-card/50 border border-border/30">
              <div className="flex items-center gap-2">
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[hsl(var(--gold))]" />
                )}
                <span className="text-sm">{isMuted ? 'Sound Off' : 'Sound On'}</span>
              </div>
              <Switch
                checked={!isMuted}
                onCheckedChange={() => {
                  toggleMute();
                  if (isMuted) {
                    setTimeout(() => playSound('buttonClick'), 50);
                  }
                }}
                data-testid="toggle-sound"
              />
            </div>
          </motion.div>

          <GoldDivider />

          <motion.div variants={item} className="space-y-3">
            <Label
              className="text-sm font-medium text-[hsl(var(--gold))] uppercase tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Card Back Design
            </Label>
            <div className="grid grid-cols-4 gap-2 p-2 rounded-xl bg-card/30">
              {DECK_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onDeckColorChange(color.value)}
                  style={{ background: color.cssGradient }}
                  className={cn(
                    'w-full aspect-[3/4] rounded-lg',
                    'shadow-md',
                    'transition-all duration-200',
                    'border-2',
                    deckColor === color.value
                      ? 'border-[hsl(var(--gold))] ring-2 ring-[hsl(var(--gold))] ring-offset-2 ring-offset-background'
                      : 'border-transparent hover:border-white/30',
                    'flex items-center justify-center'
                  )}
                  data-testid={`deck-color-${color.value}`}
                >
                  <div className="w-3/4 h-3/4 rounded border border-white/30 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-0.5">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-1 h-1 bg-white/40 rounded-full" />
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {DECK_COLORS.find(c => c.value === deckColor)?.label}
            </p>
          </motion.div>

          <GoldDivider />

          <motion.div variants={item} className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 border-[hsl(var(--gold-dim)/0.2)] hover:border-[hsl(var(--gold-dim)/0.4)]"
              style={{ fontFamily: 'var(--font-display)' }}
              onClick={onShowRules}
              data-testid="button-show-rules"
            >
              <HelpCircle className="w-4 h-4" />
              Game Rules
            </Button>

            <Button
              variant="default"
              className="w-full justify-start gap-2 shadow-[0_0_20px_hsl(var(--gold)/0.15)]"
              style={{ fontFamily: 'var(--font-display)' }}
              onClick={onNewGame}
              data-testid="button-new-game"
            >
              <RefreshCw className="w-4 h-4" />
              New Game
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start gap-2"
              style={{ fontFamily: 'var(--font-display)' }}
              onClick={onExitGame}
              data-testid="button-exit-game"
            >
              <LogOut className="w-4 h-4" />
              Exit Game
            </Button>
          </motion.div>
        </motion.div>
      </SheetContent>
    </Sheet>
  );
}

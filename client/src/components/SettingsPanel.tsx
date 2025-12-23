import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { DeckColor, DECK_COLORS } from '@shared/gameTypes';
import { cn } from '@/lib/utils';
import { RefreshCw, HelpCircle, Sun, Moon, User, Bot } from 'lucide-react';

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
  onShowRules: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  playerConfigs: PlayerConfig[];
  onTogglePlayerType: (playerId: string) => void;
  onPlayerNameChange: (playerId: string, name: string) => void;
}

export function SettingsPanel({
  open,
  onClose,
  deckColor,
  onDeckColorChange,
  onNewGame,
  onShowRules,
  darkMode,
  onToggleDarkMode,
  playerConfigs,
  onTogglePlayerType,
  onPlayerNameChange,
}: SettingsPanelProps) {
  const teamLabels = ['Your Team', 'Opponents', 'Your Team', 'Opponents'];
  const seatLabels = ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-80">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Players</Label>
            <div className="space-y-2">
              {playerConfigs.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/40"
                  data-testid={`player-config-${player.id}`}
                >
                  <button
                    onClick={() => onTogglePlayerType(player.id)}
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                      player.isHuman 
                        ? 'bg-primary text-primary-foreground' 
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
                      index === 0 || index === 2 ? 'text-primary' : 'text-orange-500'
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
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Deck Color</Label>
            <div className="grid grid-cols-3 gap-3">
              {DECK_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => onDeckColorChange(color.value)}
                  className={cn(
                    'w-full aspect-[3/4] rounded-lg',
                    'bg-gradient-to-br shadow-md',
                    color.gradient,
                    'transition-all duration-200',
                    'border-2',
                    deckColor === color.value
                      ? 'border-primary ring-2 ring-primary ring-offset-2'
                      : 'border-transparent',
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
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Dark Mode</Label>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleDarkMode}
              data-testid="button-toggle-dark-mode"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={onShowRules}
              data-testid="button-show-rules"
            >
              <HelpCircle className="w-4 h-4" />
              Game Rules
            </Button>

            <Button
              variant="default"
              className="w-full justify-start gap-2"
              onClick={onNewGame}
              data-testid="button-new-game"
            >
              <RefreshCw className="w-4 h-4" />
              New Game
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

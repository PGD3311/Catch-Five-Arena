import { Button } from '@/components/ui/button';
import { Settings, Share2, HelpCircle } from 'lucide-react';

interface GameTabsProps {
  onSettingsClick: () => void;
  onShareClick: () => void;
  onRulesClick: () => void;
}

export function GameTabs({ onSettingsClick, onShareClick, onRulesClick }: GameTabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
      <Button
        variant="ghost"
        size="sm"
        onClick={onSettingsClick}
        className="gap-2"
        data-testid="tab-settings"
      >
        <Settings className="w-4 h-4" />
        Settings
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onShareClick}
        className="gap-2"
        data-testid="tab-share"
      >
        <Share2 className="w-4 h-4" />
        Share
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRulesClick}
        className="gap-2"
        data-testid="tab-rules"
      >
        <HelpCircle className="w-4 h-4" />
        Rules
      </Button>
    </div>
  );
}

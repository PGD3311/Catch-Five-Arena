import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Check, Copy, Link2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShareModal({ open, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const gameUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Share this link with your friends to play together.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Share with Friends
          </DialogTitle>
          <DialogDescription>
            Send this link to invite friends to play Catch 5!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="share-link">Game Link</Label>
            <div className="flex gap-2">
              <Input
                id="share-link"
                value={gameUrl}
                readOnly
                className="flex-1"
                data-testid="input-share-link"
              />
              <Button
                onClick={handleCopy}
                variant={copied ? 'default' : 'outline'}
                data-testid="button-copy-link"
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="w-4 h-4" />
              How it works
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Share this link with up to 3 friends</li>
              <li>Each person opens the link in their browser</li>
              <li>Toggle players to Human in Settings</li>
              <li>Take turns on the same device or play on separate devices</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Currently supports local play - online multiplayer coming soon!
          </p>
        </div>

        <Button onClick={onClose} className="w-full" data-testid="button-close-share">
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}

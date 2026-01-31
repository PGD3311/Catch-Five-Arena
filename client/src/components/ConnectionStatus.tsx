import { AlertCircle, WifiOff, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ConnectionStatusProps {
  connected: boolean;
  reconnecting: boolean;
  roomUnavailable: boolean;
  error: string | null;
  inRoom: boolean;
  onReturnToLobby?: () => void;
}

export function ConnectionStatus({ 
  connected, 
  reconnecting, 
  roomUnavailable,
  error,
  inRoom,
  onReturnToLobby 
}: ConnectionStatusProps) {
  if (roomUnavailable) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            <p className="font-medium mb-2">Room Unavailable</p>
            <p className="text-sm mb-4">{error || 'This game room is no longer available. It may have ended or been closed.'}</p>
            {onReturnToLobby && (
              <Button onClick={onReturnToLobby} size="sm" data-testid="button-return-lobby">
                Return to Lobby
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (reconnecting && inRoom) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <Alert className="bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertDescription className="ml-2 flex items-center gap-2">
            Reconnecting to game...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Only show connection lost if we were in a room and lost connection
  if (!connected && !reconnecting && inRoom) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="ml-2">
            Connection lost. Please refresh the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
}

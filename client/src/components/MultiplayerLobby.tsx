import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Copy, Check, Play, LogOut, Wifi, WifiOff, Bot, UserPlus, Shuffle, ArrowLeftRight } from 'lucide-react';
import type { DeckColor } from '@shared/gameTypes';

interface RoomPlayer {
  seatIndex: number;
  playerName: string;
  connected: boolean;
  isCpu?: boolean;
}

interface MultiplayerLobbyProps {
  connected: boolean;
  roomCode: string | null;
  seatIndex: number | null;
  players: RoomPlayer[];
  error: string | null;
  onCreateRoom: (playerName: string, deckColor: DeckColor, targetScore: number) => void;
  onJoinRoom: (roomCode: string, playerName: string, preferredSeat?: number) => void;
  onPreviewRoom: (roomCode: string) => Promise<{ availableSeats: number[]; players: RoomPlayer[] } | null>;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onClose: () => void;
  onAddCpu: (seatIndex: number) => void;
  onRemoveCpu: (seatIndex: number) => void;
  onSwapSeats: (seat1: number, seat2: number) => void;
  onRandomizeTeams: () => void;
  deckColor: DeckColor;
  targetScore: number;
}

export function MultiplayerLobby({
  connected,
  roomCode,
  seatIndex,
  players,
  error,
  onCreateRoom,
  onJoinRoom,
  onPreviewRoom,
  onStartGame,
  onLeaveRoom,
  onClose,
  onAddCpu,
  onRemoveCpu,
  onSwapSeats,
  onRandomizeTeams,
  deckColor,
  targetScore,
}: MultiplayerLobbyProps) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'select-seat'>('menu');
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [availableSeats, setAvailableSeats] = useState<number[]>([]);
  const [previewPlayers, setPreviewPlayers] = useState<RoomPlayer[]>([]);
  const [preferredSeat, setPreferredSeat] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateRoom = () => {
    if (playerName.trim()) {
      onCreateRoom(playerName.trim(), deckColor, targetScore);
    }
  };

  const handlePreviewRoom = async () => {
    if (playerName.trim() && joinCode.trim()) {
      setIsLoading(true);
      const preview = await onPreviewRoom(joinCode.trim().toUpperCase());
      setIsLoading(false);
      if (preview) {
        setAvailableSeats(preview.availableSeats);
        setPreviewPlayers(preview.players);
        setPreferredSeat(preview.availableSeats[0] ?? null);
        setMode('select-seat');
      }
    }
  };

  const handleJoinRoom = () => {
    if (playerName.trim() && joinCode.trim()) {
      onJoinRoom(joinCode.trim().toUpperCase(), playerName.trim(), preferredSeat ?? undefined);
    }
  };

  const copyRoomCode = async () => {
    if (roomCode) {
      const url = `${window.location.origin}?room=${roomCode}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyCodeOnly = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const getSeatLabel = (index: number, showYou: boolean = true) => {
    if (showYou && index === seatIndex) {
      if (index === 0) return 'South (You)';
      if (index === 1) return 'West (You)';
      if (index === 2) return 'North (You)';
      if (index === 3) return 'East (You)';
    }
    // Partner is whoever shares your team
    if (showYou && seatIndex !== null) {
      const partnerSeat = (seatIndex + 2) % 4;
      if (index === partnerSeat) {
        const baseLabels = ['South', 'West', 'North', 'East'];
        return `${baseLabels[index]} (Partner)`;
      }
    }
    const labels = ['South', 'West', 'North', 'East'];
    return labels[index];
  };

  const getTeamLabel = (index: number) => {
    return index % 2 === 0 ? 'Team 1' : 'Team 2';
  };

  if (roomCode) {
    const isHost = seatIndex === 0;
    const allSeatsReady = players.length === 4;
    const humanCount = players.filter(p => !p.isCpu).length;
    const canStart = humanCount >= 1 && allSeatsReady;

    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Game Lobby
            </CardTitle>
            <Badge 
              variant="outline" 
              className="text-sm font-mono cursor-pointer hover-elevate"
              onClick={copyCodeOnly}
              data-testid="badge-room-code"
            >
              {codeCopied ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  {roomCode}
                </>
              )}
            </Badge>
          </div>
          <CardDescription>
            Share the room code with friends to join
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={copyRoomCode}
            variant="outline"
            className="w-full"
            data-testid="button-copy-invite"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied Invite Link
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Invite Link
              </>
            )}
          </Button>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">Players ({players.length}/4)</p>
              {isHost && players.length >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedSeat(null);
                    onRandomizeTeams();
                  }}
                  className="h-7 text-xs"
                  data-testid="button-randomize-teams"
                >
                  <Shuffle className="w-3 h-3 mr-1" />
                  Randomize
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((seat) => {
                const player = players.find(p => p.seatIndex === seat);
                const isCurrentPlayer = seat === seatIndex;
                const isSelected = selectedSeat === seat;
                const canSwap = isHost && player && selectedSeat !== null && selectedSeat !== seat;
                
                const handleSeatClick = () => {
                  if (!isHost) return;
                  if (!player) return;
                  
                  if (selectedSeat === null) {
                    setSelectedSeat(seat);
                  } else if (selectedSeat === seat) {
                    setSelectedSeat(null);
                  } else {
                    onSwapSeats(selectedSeat, seat);
                    setSelectedSeat(null);
                  }
                };
                
                return (
                  <div
                    key={seat}
                    onClick={handleSeatClick}
                    className={`p-3 rounded-md border transition-all ${
                      player
                        ? 'bg-muted/50 border-border'
                        : 'border-dashed border-muted-foreground/30'
                    } ${isCurrentPlayer ? 'ring-2 ring-primary' : ''} ${
                      isSelected ? 'ring-2 ring-amber-400 bg-amber-500/10' : ''
                    } ${canSwap ? 'cursor-pointer hover:border-amber-400' : ''} ${
                      isHost && player && !isSelected ? 'cursor-pointer hover:bg-muted' : ''
                    }`}
                    data-testid={`seat-${seat}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs text-muted-foreground">
                        {getSeatLabel(seat)}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${seat % 2 === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}
                      >
                        {getTeamLabel(seat)}
                      </Badge>
                    </div>
                    {player ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {player.isCpu ? (
                            <Bot className="w-3 h-3 text-muted-foreground shrink-0" />
                          ) : player.connected ? (
                            <Wifi className="w-3 h-3 text-green-500 shrink-0" />
                          ) : (
                            <WifiOff className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">
                            {player.playerName}
                          </span>
                          {isSelected && (
                            <ArrowLeftRight className="w-3 h-3 text-amber-400 shrink-0" />
                          )}
                        </div>
                        {player.isCpu && isHost && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveCpu(seat);
                            }}
                            data-testid={`button-remove-cpu-${seat}`}
                          >
                            <LogOut className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ) : isHost ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddCpu(seat);
                        }}
                        data-testid={`button-add-cpu-${seat}`}
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Add CPU
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Waiting...
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {isHost && selectedSeat !== null && (
              <p className="text-xs text-center text-amber-400">
                Click another player to swap positions
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex gap-2">
            {isHost && (
              <Button
                onClick={onStartGame}
                disabled={!canStart}
                className="flex-1"
                data-testid="button-start-online-game"
              >
                <Play className="w-4 h-4 mr-2" />
                {canStart ? 'Start Game' : `Fill ${4 - players.length} seats`}
              </Button>
            )}
            <Button
              onClick={onLeaveRoom}
              variant="outline"
              data-testid="button-leave-room"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          {!allSeatsReady && isHost && (
            <p className="text-xs text-center text-muted-foreground">
              Add CPU players to fill empty seats, or wait for friends to join
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Online Multiplayer
        </CardTitle>
        <CardDescription>
          Play with friends over the internet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected && (
          <div className="flex items-center justify-center gap-2 p-4 rounded-md bg-muted">
            <WifiOff className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Connecting to server...</span>
          </div>
        )}

        {mode === 'menu' && connected && (
          <div className="space-y-3">
            <Button
              onClick={() => setMode('create')}
              className="w-full"
              data-testid="button-create-room"
            >
              Create New Room
            </Button>
            <Button
              onClick={() => setMode('join')}
              variant="outline"
              className="w-full"
              data-testid="button-join-room"
            >
              Join Existing Room
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full"
              data-testid="button-cancel-multiplayer"
            >
              Cancel
            </Button>
          </div>
        )}

        {mode === 'create' && connected && (
          <div className="space-y-3">
            <Input
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              data-testid="input-player-name-create"
            />
            <Button
              onClick={handleCreateRoom}
              disabled={!playerName.trim()}
              className="w-full"
              data-testid="button-confirm-create"
            >
              Create Room
            </Button>
            <Button
              onClick={() => setMode('menu')}
              variant="ghost"
              className="w-full"
            >
              Back
            </Button>
          </div>
        )}

        {mode === 'join' && connected && (
          <div className="space-y-3">
            <Input
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              data-testid="input-player-name-join"
            />
            <Input
              placeholder="Room code (e.g., ABC123)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="font-mono text-center uppercase"
              maxLength={6}
              data-testid="input-room-code"
            />
            <Button
              onClick={handlePreviewRoom}
              disabled={!playerName.trim() || joinCode.length !== 6 || isLoading}
              className="w-full"
              data-testid="button-confirm-join"
            >
              {isLoading ? 'Loading...' : 'Next'}
            </Button>
            <Button
              onClick={() => setMode('menu')}
              variant="ghost"
              className="w-full"
            >
              Back
            </Button>
          </div>
        )}

        {mode === 'select-seat' && connected && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Tap an available seat to join
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((seat) => {
                const player = previewPlayers.find(p => p.seatIndex === seat);
                const isAvailable = availableSeats.includes(seat);
                const isJoining = preferredSeat === seat && isLoading;
                
                const handleSeatClick = () => {
                  if (!isAvailable || isLoading) return;
                  setPreferredSeat(seat);
                  setIsLoading(true);
                  onJoinRoom(joinCode.trim().toUpperCase(), playerName.trim(), seat);
                };
                
                return (
                  <div
                    key={seat}
                    onClick={handleSeatClick}
                    className={`p-3 rounded-md border transition-all ${
                      player
                        ? 'bg-muted/50 border-border opacity-60 cursor-not-allowed'
                        : isJoining
                        ? 'border-primary bg-primary/10 ring-2 ring-primary'
                        : isLoading
                        ? 'border-muted opacity-50 cursor-not-allowed'
                        : 'border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 hover:bg-primary/5'
                    }`}
                    data-testid={`select-seat-${seat}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs text-muted-foreground">
                        {getSeatLabel(seat, false)}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${seat % 2 === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}
                      >
                        {getTeamLabel(seat)}
                      </Badge>
                    </div>
                    {player ? (
                      <div className="flex items-center gap-2">
                        {player.isCpu ? (
                          <Bot className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <Wifi className="w-3 h-3 text-green-500" />
                        )}
                        <span className="text-sm font-medium truncate">
                          {player.playerName}
                        </span>
                      </div>
                    ) : (
                      <span className={`text-sm ${isJoining ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                        {isJoining ? 'Joining...' : 'Tap to join'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              onClick={() => {
                setMode('join');
                setIsLoading(false);
              }}
              variant="ghost"
              className="w-full"
            >
              Back
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}

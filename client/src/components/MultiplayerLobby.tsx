import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Copy, Check, Play, LogOut, Wifi, WifiOff, Bot, UserPlus, Shuffle, ArrowLeftRight, KeyRound, Heart, Spade, Diamond, Club } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DeckColor } from '@shared/gameTypes';
import { isValidPin, getPlayerNameFromPin } from '@shared/pinCodes';

const PIN_STORAGE_KEY = "catch5_pin";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const pageVariants = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.18 } },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const staggerChild = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

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
  userId?: string;
  onCreateRoom: (playerName: string, deckColor: DeckColor, targetScore: number, userId?: string) => void;
  onJoinRoom: (roomCode: string, playerName: string, preferredSeat?: number, userId?: string) => void;
  onPreviewRoom: (roomCode: string) => Promise<{ availableSeats: number[]; players: RoomPlayer[] } | null>;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onClose: () => void;
  onAddCpu: (seatIndex: number) => void;
  onRemoveCpu: (seatIndex: number) => void;
  onKickPlayer: (seatIndex: number) => void;
  onSwapSeats: (seat1: number, seat2: number) => void;
  onRandomizeTeams: () => void;
  deckColor: DeckColor;
  targetScore: number;
}

const teamColor = (seat: number) =>
  seat % 2 === 0
    ? { bg: 'bg-[hsl(var(--team-blue)/0.12)]', text: 'text-[hsl(var(--team-blue))]', border: 'border-l-[hsl(var(--team-blue)/0.4)]' }
    : { bg: 'bg-[hsl(var(--team-red)/0.12)]', text: 'text-[hsl(var(--team-red))]', border: 'border-l-[hsl(var(--team-red)/0.4)]' };

function LobbyHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center space-y-2 pb-4">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="text-2xl font-bold tracking-tight gold-text"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground/50"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {subtitle}
      </motion.p>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT }}
        className="mx-auto w-16 h-px bg-gradient-to-r from-transparent via-[hsl(var(--gold)/0.4)] to-transparent"
      />
    </div>
  );
}

function SeatTile({
  seat,
  player,
  label,
  teamLabel,
  isCurrentPlayer,
  isSelected,
  canSwap,
  isHost,
  onClick,
  children,
}: {
  seat: number;
  player: RoomPlayer | undefined;
  label: string;
  teamLabel: string;
  isCurrentPlayer?: boolean;
  isSelected?: boolean;
  canSwap?: boolean;
  isHost?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const tc = teamColor(seat);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.08 * seat, type: 'spring', stiffness: 300, damping: 22 }}
      onClick={onClick}
      className={cn(
        'p-2.5 rounded-xl border-l-2 border transition-all',
        tc.border,
        player ? 'bg-card/60 border-border/40' : 'border-dashed border-[hsl(var(--gold-dim)/0.2)]',
        isCurrentPlayer && 'ring-2 ring-[hsl(var(--gold)/0.4)]',
        isSelected && 'ring-2 ring-amber-400 bg-amber-500/10',
        canSwap && 'cursor-pointer hover:border-amber-400',
        isHost && player && !isSelected && 'cursor-pointer hover:bg-muted/40',
      )}
      data-testid={`seat-${seat}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-[11px] text-muted-foreground/70" style={{ fontFamily: 'var(--font-display)' }}>
          {label}
        </span>
        <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', tc.bg, tc.text)}>
          {teamLabel}
        </Badge>
      </div>
      {children}
    </motion.div>
  );
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
  onKickPlayer,
  onSwapSeats,
  onRandomizeTeams,
  deckColor,
  targetScore,
  userId,
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
  const [pinCode, setPinCode] = useState('');

  useEffect(() => {
    const savedPin = localStorage.getItem(PIN_STORAGE_KEY);
    if (savedPin && isValidPin(savedPin)) {
      setPinCode(savedPin);
      const name = getPlayerNameFromPin(savedPin);
      if (name) setPlayerName(name);
    }
  }, []);

  const handleCreateRoom = () => {
    if (playerName.trim()) {
      const statsId = isValidPin(pinCode) ? pinCode : undefined;
      if (statsId) localStorage.setItem(PIN_STORAGE_KEY, pinCode);
      onCreateRoom(playerName.trim(), deckColor, targetScore, statsId);
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
      const statsId = isValidPin(pinCode) ? pinCode : undefined;
      if (statsId) localStorage.setItem(PIN_STORAGE_KEY, pinCode);
      onJoinRoom(joinCode.trim().toUpperCase(), playerName.trim(), preferredSeat ?? undefined, statsId);
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

  const inputClass = 'bg-[hsl(var(--felt)/0.08)] border-[hsl(var(--gold-dim)/0.2)] focus:border-[hsl(var(--gold)/0.4)]';

  // ── In-Room Lobby ──
  if (roomCode) {
    const isHost = seatIndex === 0;
    const allSeatsReady = players.length === 4;
    const humanCount = players.filter(p => !p.isCpu).length;
    const canStart = humanCount >= 1 && allSeatsReady;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="w-full max-w-md mx-auto bg-card/80 backdrop-blur-sm border border-[hsl(var(--gold-dim)/0.15)] rounded-2xl overflow-hidden relative"
      >
        <div className="p-5 space-y-5">
          <LobbyHeader title="Game Lobby" subtitle="Share the code with friends" />

          {/* Room code hero */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 25 }}
            className="text-center p-4 rounded-xl bg-[hsl(var(--gold)/0.05)] border border-[hsl(var(--gold)/0.15)]"
            data-testid="badge-room-code"
            onClick={copyCodeOnly}
          >
            <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground/40 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              Room Code
            </p>
            <p className="text-3xl font-bold font-mono tracking-[0.3em] gold-text cursor-pointer">
              {codeCopied ? 'COPIED' : roomCode}
            </p>
          </motion.div>

          {/* Copy invite */}
          <Button
            onClick={copyRoomCode}
            variant="outline"
            className="w-full border-[hsl(var(--gold-dim)/0.2)] text-muted-foreground/70 hover:text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
            data-testid="button-copy-invite"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5 mr-2 text-[hsl(var(--gold))]" /> Copied Invite Link</>
            ) : (
              <><Copy className="w-3.5 h-3.5 mr-2" /> Copy Invite Link</>
            )}
          </Button>

          {/* Players grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground/60" style={{ fontFamily: 'var(--font-display)' }}>
                Players ({players.length}/4)
              </p>
              {isHost && players.length >= 2 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelectedSeat(null); onRandomizeTeams(); }}
                  className="h-7 text-[11px] border-[hsl(var(--gold-dim)/0.25)] text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold)/0.06)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                  data-testid="button-randomize-teams"
                >
                  <Shuffle className="w-3 h-3 mr-1" /> Randomize
                </Button>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-1 rounded-xl felt-surface opacity-30 pointer-events-none" />
              <div className="relative grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((seat) => {
                  const player = players.find(p => p.seatIndex === seat);
                  const isCurrentPlayer = seat === seatIndex;
                  const isSelected = selectedSeat === seat;
                  const canSwap = isHost && !!player && selectedSeat !== null && selectedSeat !== seat;

                  const handleSeatClick = () => {
                    if (!isHost) return;
                    if (!player) return;
                    if (selectedSeat === null) { setSelectedSeat(seat); }
                    else if (selectedSeat === seat) { setSelectedSeat(null); }
                    else { onSwapSeats(selectedSeat, seat); setSelectedSeat(null); }
                  };

                  return (
                    <SeatTile
                      key={seat}
                      seat={seat}
                      player={player}
                      label={getSeatLabel(seat)}
                      teamLabel={getTeamLabel(seat)}
                      isCurrentPlayer={isCurrentPlayer}
                      isSelected={isSelected}
                      canSwap={canSwap}
                      isHost={isHost}
                      onClick={handleSeatClick}
                    >
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
                            <span className="text-sm font-semibold truncate" style={{ fontFamily: 'var(--font-display)' }}>
                              {player.playerName}
                            </span>
                            {isSelected && <ArrowLeftRight className="w-3 h-3 text-amber-400 shrink-0" />}
                          </div>
                          {isHost && !isCurrentPlayer && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 shrink-0 hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (player.isCpu) onRemoveCpu(seat);
                                else onKickPlayer(seat);
                              }}
                              data-testid={`button-remove-player-${seat}`}
                            >
                              <LogOut className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ) : isHost ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full h-7 text-xs text-muted-foreground/50"
                          onClick={(e) => { e.stopPropagation(); onAddCpu(seat); }}
                          data-testid={`button-add-cpu-${seat}`}
                        >
                          <Bot className="w-3 h-3 mr-1" /> Add CPU
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground/40">Waiting...</span>
                      )}
                    </SeatTile>
                  );
                })}
              </div>
            </div>

            <AnimatePresence>
              {isHost && selectedSeat !== null && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[11px] text-center text-amber-400"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Tap another player to swap positions
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-destructive text-center">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-2">
            {isHost && (
              <Button
                onClick={onStartGame}
                disabled={!canStart}
                className="flex-1 shadow-[0_0_24px_hsl(var(--gold)/0.12)] hover:shadow-[0_0_32px_hsl(var(--gold)/0.2)] transition-shadow"
                style={{ fontFamily: 'var(--font-display)' }}
                data-testid="button-start-online-game"
              >
                <Play className="w-4 h-4 mr-2" />
                {canStart ? 'Start Game' : `Fill ${4 - players.length} seats`}
              </Button>
            )}
            <Button onClick={onLeaveRoom} variant="outline" className="text-muted-foreground/60" data-testid="button-leave-room">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          {!allSeatsReady && isHost && (
            <p className="text-[11px] text-center text-muted-foreground/40" style={{ fontFamily: 'var(--font-display)' }}>
              Add CPU players or wait for friends to join
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Pre-Room Views ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      className="w-full max-w-md mx-auto bg-card/80 backdrop-blur-sm border border-[hsl(var(--gold-dim)/0.15)] rounded-2xl overflow-hidden relative"
    >
      <div className="p-5 space-y-5">
        <LobbyHeader title="Multiplayer" subtitle="Play with friends" />

        {!connected && (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center justify-center gap-2 p-4 rounded-xl bg-[hsl(var(--felt)/0.08)] border border-[hsl(var(--gold-dim)/0.1)]"
          >
            <WifiOff className="w-4 h-4 text-muted-foreground/50" />
            <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground/50" style={{ fontFamily: 'var(--font-display)' }}>
              Connecting...
            </span>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {mode === 'menu' && connected && (
            <motion.div key="menu" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <motion.div className="space-y-3" variants={staggerContainer} initial="initial" animate="animate">
                <motion.div variants={staggerChild}>
                  <Button
                    onClick={() => setMode('create')}
                    className="w-full shadow-[0_0_24px_hsl(var(--gold)/0.1)] hover:shadow-[0_0_32px_hsl(var(--gold)/0.2)] transition-shadow"
                    style={{ fontFamily: 'var(--font-display)' }}
                    data-testid="button-create-room"
                  >
                    <UserPlus className="w-4 h-4 mr-2" /> Create New Room
                  </Button>
                </motion.div>
                <motion.div variants={staggerChild}>
                  <Button
                    onClick={() => setMode('join')}
                    variant="outline"
                    className="w-full border-[hsl(var(--gold-dim)/0.2)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                    data-testid="button-join-room"
                  >
                    <Users className="w-4 h-4 mr-2" /> Join Existing Room
                  </Button>
                </motion.div>
                <motion.div variants={staggerChild}>
                  <button
                    onClick={onClose}
                    className="w-full py-2 text-muted-foreground/40 hover:text-muted-foreground/70 text-xs tracking-[0.15em] uppercase transition-colors"
                    style={{ fontFamily: 'var(--font-display)' }}
                    data-testid="button-cancel-multiplayer"
                  >
                    Cancel
                  </button>
                </motion.div>
                <motion.div variants={staggerChild} className="flex items-center justify-center gap-3 pt-2 text-muted-foreground/15">
                  <Spade size={12} fill="currentColor" />
                  <Heart size={12} fill="currentColor" className="text-red-400/20" />
                  <Diamond size={12} fill="currentColor" className="text-blue-400/20" />
                  <Club size={12} fill="currentColor" className="text-emerald-400/20" />
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {mode === 'create' && connected && (
            <motion.div key="create" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <motion.div className="space-y-3" variants={staggerContainer} initial="initial" animate="animate">
                <motion.div variants={staggerChild}>
                  <Input
                    placeholder="Your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className={inputClass}
                    data-testid="input-player-name-create"
                  />
                </motion.div>
                <motion.div variants={staggerChild}>
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[hsl(var(--gold-dim))] flex-shrink-0" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="4-digit stats code (optional)"
                      value={pinCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setPinCode(val);
                        if (val.length === 4 && isValidPin(val)) {
                          const name = getPlayerNameFromPin(val);
                          if (name) setPlayerName(name);
                        }
                      }}
                      className={cn('font-mono tracking-widest', inputClass)}
                      data-testid="input-pin-create"
                    />
                  </div>
                </motion.div>
                <AnimatePresence>
                  {pinCode.length === 4 && !isValidPin(pinCode) && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs text-destructive">
                      Invalid code - stats won't be tracked
                    </motion.p>
                  )}
                </AnimatePresence>
                <motion.div variants={staggerChild}>
                  <Button
                    onClick={handleCreateRoom}
                    disabled={!playerName.trim()}
                    className="w-full shadow-[0_0_24px_hsl(var(--gold)/0.1)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                    data-testid="button-confirm-create"
                  >
                    Create Room
                  </Button>
                </motion.div>
                <motion.div variants={staggerChild}>
                  <button
                    onClick={() => setMode('menu')}
                    className="w-full py-2 text-muted-foreground/40 hover:text-muted-foreground/70 text-xs tracking-[0.15em] uppercase transition-colors"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Back
                  </button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {mode === 'join' && connected && (
            <motion.div key="join" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <motion.div className="space-y-3" variants={staggerContainer} initial="initial" animate="animate">
                <motion.div variants={staggerChild}>
                  <Input
                    placeholder="Your name"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className={inputClass}
                    data-testid="input-player-name-join"
                  />
                </motion.div>
                <motion.div variants={staggerChild}>
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[hsl(var(--gold-dim))] flex-shrink-0" />
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder="4-digit stats code (optional)"
                      value={pinCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setPinCode(val);
                        if (val.length === 4 && isValidPin(val)) {
                          const name = getPlayerNameFromPin(val);
                          if (name) setPlayerName(name);
                        }
                      }}
                      className={cn('font-mono tracking-widest', inputClass)}
                      data-testid="input-pin-join"
                    />
                  </div>
                </motion.div>
                <AnimatePresence>
                  {pinCode.length === 4 && !isValidPin(pinCode) && (
                    <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs text-destructive">
                      Invalid code - stats won't be tracked
                    </motion.p>
                  )}
                </AnimatePresence>
                <motion.div variants={staggerChild}>
                  <Input
                    placeholder="Room code (e.g., ABC123)"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className={cn('font-mono text-center uppercase', inputClass)}
                    maxLength={6}
                    data-testid="input-room-code"
                  />
                </motion.div>
                <motion.div variants={staggerChild}>
                  <Button
                    onClick={handlePreviewRoom}
                    disabled={!playerName.trim() || joinCode.length !== 6 || isLoading}
                    className="w-full shadow-[0_0_24px_hsl(var(--gold)/0.1)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                    data-testid="button-confirm-join"
                  >
                    {isLoading ? 'Loading...' : 'Next'}
                  </Button>
                </motion.div>
                <motion.div variants={staggerChild}>
                  <button
                    onClick={() => setMode('menu')}
                    className="w-full py-2 text-muted-foreground/40 hover:text-muted-foreground/70 text-xs tracking-[0.15em] uppercase transition-colors"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Back
                  </button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {mode === 'select-seat' && connected && (
            <motion.div key="select-seat" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <div className="space-y-3">
                <p className="text-xs text-center text-muted-foreground/50 tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                  Tap an available seat to join
                </p>
                <div className="relative">
                  <div className="absolute inset-1 rounded-xl felt-surface opacity-30 pointer-events-none" />
                  <div className="relative grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((seat) => {
                      const player = previewPlayers.find(p => p.seatIndex === seat);
                      const isAvailable = availableSeats.includes(seat);
                      const isJoining = preferredSeat === seat && isLoading;

                      const handleSeatClick = () => {
                        if (!isAvailable || isLoading) return;
                        setPreferredSeat(seat);
                        setIsLoading(true);
                        const statsId = isValidPin(pinCode) ? pinCode : undefined;
                        if (statsId) localStorage.setItem(PIN_STORAGE_KEY, pinCode);
                        onJoinRoom(joinCode.trim().toUpperCase(), playerName.trim(), seat, statsId);
                      };

                      return (
                        <motion.div
                          key={seat}
                          initial={{ opacity: 0, scale: 0.88, y: 6 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ delay: 0.08 * seat, type: 'spring', stiffness: 300, damping: 22 }}
                          onClick={handleSeatClick}
                          className={cn(
                            'p-2.5 rounded-xl border-l-2 border transition-all',
                            teamColor(seat).border,
                            player
                              ? 'bg-muted/40 border-border/40 opacity-60 cursor-not-allowed'
                              : isJoining
                              ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.06)] ring-2 ring-[hsl(var(--gold))]'
                              : isLoading
                              ? 'border-muted opacity-50 cursor-not-allowed'
                              : 'border-dashed border-[hsl(var(--gold-dim)/0.2)] cursor-pointer hover:border-[hsl(var(--gold)/0.4)] hover:bg-[hsl(var(--gold)/0.04)]'
                          )}
                          data-testid={`select-seat-${seat}`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="text-[11px] text-muted-foreground/70" style={{ fontFamily: 'var(--font-display)' }}>
                              {getSeatLabel(seat, false)}
                            </span>
                            <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', teamColor(seat).bg, teamColor(seat).text)}>
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
                              <span className="text-sm font-medium truncate" style={{ fontFamily: 'var(--font-display)' }}>
                                {player.playerName}
                              </span>
                            </div>
                          ) : (
                            <span className={cn('text-sm', isJoining ? 'text-[hsl(var(--gold))] font-medium' : 'text-muted-foreground/40')} style={{ fontFamily: 'var(--font-display)' }}>
                              {isJoining ? 'Joining...' : 'Tap to join'}
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={() => { setMode('join'); setIsLoading(false); }}
                  className="w-full py-2 text-muted-foreground/40 hover:text-muted-foreground/70 text-xs tracking-[0.15em] uppercase transition-colors"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Back
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-destructive text-center">
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trophy, Target, XCircle, TrendingUp, Hash, Crown, Spade, Skull } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { PIN_CODES } from '@shared/pinCodes';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface LeaderboardEntry {
  userId: string;
  playerName: string | null;
  gamesPlayed: number;
  gamesWon: number;
  bidsMade: number;
  bidsSucceeded: number;
  timesSet: number;
  totalPointsScored: number;
  totalBidAmount: number;
}

interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  bidsMade: number;
  bidsSucceeded: number;
  timesSet: number;
  totalPointsScored: number;
  totalBidAmount: number;
}

interface StatsPageProps {
  onBack: () => void;
}

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

function StatBox({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={cn(
      'flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors',
      accent
        ? 'bg-[hsl(var(--gold)/0.08)] border-[hsl(var(--gold)/0.2)]'
        : 'bg-card/50 border-border/30'
    )}>
      <Icon className={cn('w-4 h-4', accent ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground/50')} />
      <span
        className={cn('text-xl font-bold tabular-nums', accent ? 'gold-text' : 'text-foreground')}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value}
      </span>
      <span
        className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground/50"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {label}
      </span>
    </div>
  );
}

function getRankMedal(index: number) {
  if (index === 0) return { emoji: '🥇', color: 'text-yellow-400' };
  if (index === 1) return { emoji: '🥈', color: 'text-slate-300' };
  if (index === 2) return { emoji: '🥉', color: 'text-amber-600' };
  return null;
}

interface RankTableProps {
  title: string;
  icon: any;
  iconColor: string;
  titleClass: string;
  entries: LeaderboardEntry[];
  loading: boolean;
  emptyText: string;
  emptySubtext: string;
  sortValue: (e: LeaderboardEntry) => number;
  highlightFirst?: boolean;
  highlightColor?: string;
  firstNameClass?: string;
  delay?: number;
}

function RankTable({ title, icon: Icon, iconColor, titleClass, entries, loading, emptyText, emptySubtext, sortValue, highlightFirst, highlightColor, firstNameClass, delay = 0 }: RankTableProps) {
  const sorted = [...entries].sort((a, b) => sortValue(b) - sortValue(a));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: EASE_OUT }}
      className="w-full mb-6"
    >
      <div className="rounded-xl border border-[hsl(var(--gold-dim)/0.15)] bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-4 pb-2 flex items-center justify-center gap-2">
          <Icon className={cn('w-4 h-4', iconColor)} />
          <h3
            className={cn('text-sm font-bold tracking-[0.15em] uppercase', titleClass)}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h3>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>

        <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem] px-4 py-2 text-[10px] tracking-[0.1em] uppercase text-muted-foreground/40 border-b border-border/20"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="text-center">#</span>
          <span>Player</span>
          <span className="text-center">W</span>
          <span className="text-center">L</span>
          <span className="text-center">Win%</span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-muted-foreground/40 text-sm"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Loading...
            </motion.div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground/40 text-sm" style={{ fontFamily: 'var(--font-display)' }}>
              {emptyText}
            </p>
            <p className="text-muted-foreground/30 text-xs mt-1" style={{ fontFamily: 'var(--font-display)' }}>
              {emptySubtext}
            </p>
          </div>
        ) : (
          <motion.div variants={staggerContainer} initial="hidden" animate="show">
            {sorted.map((entry, index) => {
              const medal = getRankMedal(index);
              const winPct = entry.gamesPlayed > 0
                ? Math.round((entry.gamesWon / entry.gamesPlayed) * 100)
                : 0;
              const losses = entry.gamesPlayed - entry.gamesWon;

              return (
                <motion.div
                  key={entry.userId}
                  variants={staggerChild}
                  className={cn(
                    'grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem] px-4 py-3 items-center border-b border-border/10 last:border-0 transition-colors',
                    highlightFirst && index === 0 && highlightColor
                  )}
                >
                  <span className="text-center">
                    {medal ? (
                      <span className="text-base">{medal.emoji}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40 tabular-nums font-medium">{index + 1}</span>
                    )}
                  </span>

                  <span
                    className={cn(
                      'font-semibold text-sm capitalize',
                      highlightFirst && index === 0 ? firstNameClass : 'text-foreground/80'
                    )}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {entry.playerName || 'Unknown'}
                  </span>

                  <span className="text-center text-sm font-semibold tabular-nums text-emerald-400/80">
                    {entry.gamesWon}
                  </span>

                  <span className="text-center text-sm tabular-nums text-muted-foreground/50">
                    {losses}
                  </span>

                  <span className={cn(
                    'text-center text-sm tabular-nums font-medium',
                    winPct >= 60 ? 'text-emerald-400/80' : winPct >= 40 ? 'text-muted-foreground/60' : 'text-red-400/60'
                  )}>
                    {entry.gamesPlayed > 0 ? `${winPct}%` : '—'}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export function StatsPage({ onBack }: StatsPageProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [pinError, setPinError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    fetch('/api/leaderboard/pin')
      .then(res => res.json())
      .then(data => {
        setLeaderboard(data.filter((entry: LeaderboardEntry) => entry.playerName));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const winnerBoard = leaderboard.filter(e => e.gamesWon > 0);
  const loserBoard = leaderboard.filter(e => (e.gamesPlayed - e.gamesWon) > 0);

  const handlePinLookup = async () => {
    if (pin.length !== 4) {
      setPinError('Enter your 4-digit PIN');
      return;
    }
    setPinError('');
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/stats/pin/${pin}`);
      if (!res.ok) {
        setPinError('Invalid PIN');
        setPlayerStats(null);
        setPlayerName(null);
      } else {
        const data = await res.json();
        setPlayerStats(data);
        setPlayerName(PIN_CODES[pin] || null);
      }
    } catch {
      setPinError('Could not load stats');
    }
    setLookupLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center relative overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full">
      {/* Back button */}
      <motion.div
        className="self-start mb-4"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground/50 hover:text-muted-foreground/80 gap-1.5"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </motion.div>

      {/* Header */}
      <div className="text-center space-y-2 mb-8">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="text-3xl font-bold tracking-tight gold-text"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Stats & Leaderboard
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="text-xs tracking-[0.2em] uppercase text-muted-foreground/50"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Who runs the table?
        </motion.p>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT }}
          className="mx-auto w-20 h-px bg-gradient-to-r from-transparent via-[hsl(var(--gold)/0.4)] to-transparent"
        />
      </div>

      {/* PIN Lookup */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4, ease: EASE_OUT }}
        className="w-full mb-8"
      >
        <div className="rounded-xl border border-[hsl(var(--gold-dim)/0.15)] bg-card/60 backdrop-blur-sm p-4 space-y-3">
          <p
            className="text-xs tracking-[0.15em] uppercase text-muted-foreground/50 text-center"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Look up your stats
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                setPinError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handlePinLookup()}
              className="text-center text-lg tracking-[0.3em] font-mono bg-card/80 border-border/40 focus:border-[hsl(var(--gold-dim)/0.4)]"
              style={{ fontFamily: 'var(--font-display)' }}
            />
            <Button
              onClick={handlePinLookup}
              disabled={lookupLoading}
              className="px-6 shadow-[0_0_16px_hsl(var(--gold)/0.1)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {lookupLoading ? '...' : 'Go'}
            </Button>
          </div>
          <AnimatePresence>
            {pinError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-400 text-center"
              >
                {pinError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Player Stats Card */}
      <AnimatePresence mode="wait">
        {playerStats && (
          <motion.div
            key="player-stats"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
            className="w-full mb-8"
          >
            <div className="rounded-xl border border-[hsl(var(--gold)/0.2)] bg-[hsl(var(--gold)/0.04)] backdrop-blur-sm p-5 space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Spade className="w-4 h-4 text-[hsl(var(--gold))]" />
                <h3
                  className="text-lg font-bold gold-text"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {playerName || 'Player'}
                </h3>
                <Spade className="w-4 h-4 text-[hsl(var(--gold))]" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <StatBox icon={Hash} label="Played" value={playerStats.gamesPlayed} />
                <StatBox icon={Trophy} label="Won" value={playerStats.gamesWon} accent />
                <StatBox icon={TrendingUp} label="Win %" value={
                  playerStats.gamesPlayed > 0
                    ? `${Math.round((playerStats.gamesWon / playerStats.gamesPlayed) * 100)}%`
                    : '—'
                } />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <StatBox icon={Target} label="Bids Won" value={playerStats.bidsSucceeded} />
                <StatBox icon={XCircle} label="Times Set" value={playerStats.timesSet} />
                <StatBox icon={TrendingUp} label="Bid %" value={
                  playerStats.bidsMade > 0
                    ? `${Math.round((playerStats.bidsSucceeded / playerStats.bidsMade) * 100)}%`
                    : '—'
                } />
              </div>
              <div className="text-center">
                <span className="text-xs text-muted-foreground/40" style={{ fontFamily: 'var(--font-display)' }}>
                  Total points scored: <span className="text-muted-foreground/60 font-semibold tabular-nums">{playerStats.totalPointsScored}</span>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner Board */}
      <RankTable
        title="Winner Board"
        icon={Crown}
        iconColor="text-[hsl(var(--gold))]"
        titleClass="gold-text"
        entries={winnerBoard}
        loading={loading}
        emptyText="No games played yet"
        emptySubtext="Play some games to see the leaderboard!"
        sortValue={(e) => e.gamesWon}
        highlightFirst
        highlightColor="bg-[hsl(var(--gold)/0.06)]"
        firstNameClass="gold-text"
        delay={0.35}
      />

      {/* Loser Board */}
      <RankTable
        title="Loser Board"
        icon={Skull}
        iconColor="text-red-400/80"
        titleClass="text-red-400/80"
        entries={loserBoard}
        loading={loading}
        emptyText="No losses yet"
        emptySubtext="Someone's gotta lose eventually!"
        sortValue={(e) => e.gamesPlayed - e.gamesWon}
        highlightFirst
        highlightColor="bg-red-400/[0.06]"
        firstNameClass="text-red-400/80"
        delay={0.5}
      />

      {/* Bottom spacer */}
      <div className="h-6" />
    </div>
  );
}

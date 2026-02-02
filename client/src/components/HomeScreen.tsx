import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Heart, Diamond, Club, Spade } from 'lucide-react';

interface HomeScreenProps {
  onPlay: () => void;
  onRules: () => void;
}

const suits = [
  { Icon: Spade, color: 'text-slate-400/20', x: '12%', y: '18%', size: 48, rotate: -15, delay: 0.8 },
  { Icon: Heart, color: 'text-red-400/15', x: '85%', y: '22%', size: 36, rotate: 12, delay: 1.0 },
  { Icon: Diamond, color: 'text-blue-400/15', x: '8%', y: '75%', size: 32, rotate: 20, delay: 1.2 },
  { Icon: Club, color: 'text-emerald-400/15', x: '88%', y: '70%', size: 40, rotate: -8, delay: 1.4 },
  { Icon: Heart, color: 'text-red-400/10', x: '22%', y: '45%', size: 24, rotate: 30, delay: 1.6 },
  { Icon: Spade, color: 'text-slate-400/10', x: '75%', y: '48%', size: 28, rotate: -25, delay: 1.8 },
];

export function HomeScreen({ onPlay, onRules }: HomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-6">
      {/* Floating suit decorations */}
      {suits.map((suit, i) => (
        <motion.div
          key={i}
          className={`absolute pointer-events-none ${suit.color}`}
          style={{ left: suit.x, top: suit.y }}
          initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
          animate={{
            opacity: 1,
            scale: 1,
            rotate: suit.rotate,
            y: [0, -8, 0],
          }}
          transition={{
            opacity: { delay: suit.delay, duration: 0.6 },
            scale: { delay: suit.delay, duration: 0.6, type: 'spring', stiffness: 200 },
            rotate: { delay: suit.delay, duration: 0.8 },
            y: { delay: suit.delay + 0.6, duration: 4, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <suit.Icon size={suit.size} fill="currentColor" />
        </motion.div>
      ))}

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-12">
        {/* Title block */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1
              className="text-7xl sm:text-8xl font-black tracking-tighter gold-text leading-none"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Catch 5
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <p
              className="text-sm tracking-[0.25em] uppercase text-muted-foreground/50 font-medium"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Grab a Pahtnah
            </p>
          </motion.div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-24 h-px bg-gradient-to-r from-transparent via-[hsl(var(--gold)/0.4)] to-transparent"
          />
        </div>

        {/* Buttons */}
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <Button
            size="lg"
            onClick={onPlay}
            className="px-12 py-6 text-lg font-bold tracking-wide rounded-xl shadow-[0_0_30px_hsl(var(--gold)/0.15)] hover:shadow-[0_0_40px_hsl(var(--gold)/0.25)] transition-shadow duration-300"
            style={{ fontFamily: 'var(--font-display)' }}
            data-testid="button-play"
          >
            Play
          </Button>

          <Button
            variant="ghost"
            onClick={onRules}
            className="text-muted-foreground/40 hover:text-muted-foreground/70 text-xs tracking-[0.2em] uppercase font-medium"
            style={{ fontFamily: 'var(--font-display)' }}
            data-testid="button-how-to-play"
          >
            How to Play
          </Button>
        </motion.div>

        {/* Suit strip at bottom */}
        <motion.div
          className="flex items-center gap-3 text-muted-foreground/15"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          <Spade size={14} fill="currentColor" />
          <Heart size={14} fill="currentColor" className="text-red-400/20" />
          <Diamond size={14} fill="currentColor" className="text-blue-400/20" />
          <Club size={14} fill="currentColor" className="text-emerald-400/20" />
        </motion.div>
      </div>
    </div>
  );
}

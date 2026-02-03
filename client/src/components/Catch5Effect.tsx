import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';

interface Catch5EffectProps {
  onShake?: () => void;
  cardId: string;
}

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  duration: number;
  hue: number;
}

// Module-level guard: once a card ID has shown its slam effect,
// any remount for the same ID renders nothing. Survives React
// unmount/remount cycles that component-local refs cannot.
const shownEffects = new Set<string>();

export function resetShownEffects() {
  shownEffects.clear();
}

// Stable keyframe references — prevents Framer Motion from
// replaying animations when the parent re-renders.
const TEXT_SCALE = [0, 1.2, 1];
const TEXT_OPACITY = [0, 1, 1, 0];
const TEXT_TIMES = [0, 0.12, 0.55, 1];
const RING_INITIAL = { scale: 0, opacity: 0.8 };
const RING_ANIMATE = { scale: 3, opacity: 0 };

export function Catch5Effect({ onShake, cardId }: Catch5EffectProps) {
  const alreadyShown = shownEffects.has(cardId);

  // All hooks must run unconditionally (Rules of Hooks)
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    if (!alreadyShown) {
      shownEffects.add(cardId);
      onShakeRef.current?.();
    }
  }, [cardId, alreadyShown]);

  const particles = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const distance = 80 + Math.random() * 80;
      return {
        id: i,
        angle,
        distance,
        size: 3 + Math.random() * 3,
        duration: 0.5 + Math.random() * 0.3,
        hue: 38 + Math.random() * 10,
        endX: Math.cos(angle) * distance,
        endY: Math.sin(angle) * distance,
        animate: { scale: [1, 0] as number[], x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, opacity: [1, 0] as number[] },
      };
    });
  }, []);

  // Remount for a card that already played — render nothing
  if (alreadyShown) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      {/* Shockwave ring */}
      <motion.div
        initial={RING_INITIAL}
        animate={RING_ANIMATE}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="absolute rounded-full"
        style={{
          width: 80,
          height: 80,
          border: '3px solid hsl(42, 82%, 58%)',
          boxShadow: '0 0 16px hsl(42 82% 58% / 0.4)',
        }}
      />

      {/* Gold particle burst */}
      {particles.map((p) => {
        return (
          <motion.div
            key={p.id}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={p.animate}
            transition={{ duration: p.duration, ease: 'easeOut' }}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: `hsl(${p.hue}, 82%, 58%)`,
              boxShadow: `0 0 4px hsl(${p.hue} 82% 58% / 0.6)`,
            }}
          />
        );
      })}

      {/* "CATCH 5!" text */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: TEXT_SCALE, opacity: TEXT_OPACITY }}
        transition={{ duration: 1.5, times: TEXT_TIMES, ease: 'easeOut' }}
        className="absolute gold-text"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1rem, 3vw, 1.6rem)',
          fontWeight: 800,
          letterSpacing: '0.05em',
          textShadow: '0 0 20px hsl(42 82% 58% / 0.5)',
          top: '-2.5rem',
          whiteSpace: 'nowrap',
        }}
      >
        NOW THAT'S A PAHTNAH!
      </motion.div>
    </div>
  );
}

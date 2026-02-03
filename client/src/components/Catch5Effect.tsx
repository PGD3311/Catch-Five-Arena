import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

interface Catch5EffectProps {
  onShake?: () => void;
}

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  duration: number;
  hue: number;
}

export function Catch5Effect({ onShake }: Catch5EffectProps) {
  useEffect(() => {
    onShake?.();
  }, [onShake]);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      angle: (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      distance: 80 + Math.random() * 80,
      size: 3 + Math.random() * 3,
      duration: 0.5 + Math.random() * 0.3,
      hue: 38 + Math.random() * 10,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 50 }}>
      {/* Shockwave ring */}
      <motion.div
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 3, opacity: 0 }}
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
        const endX = Math.cos(p.angle) * p.distance;
        const endY = Math.sin(p.angle) * p.distance;
        return (
          <motion.div
            key={p.id}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{ scale: [1, 0], x: endX, y: endY, opacity: [1, 0] }}
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
        animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.5, times: [0, 0.12, 0.55, 1], ease: 'easeOut' }}
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

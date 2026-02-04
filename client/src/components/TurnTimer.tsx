import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface TurnTimerProps {
  isActive: boolean;
  duration?: number;
  onTimeout?: () => void;
  playerName?: string;
  isCurrentPlayer?: boolean;
  serverStartTime?: number;
}

export function TurnTimer({
  isActive,
  duration = 20,
  onTimeout,
  playerName,
  isCurrentPlayer = false,
  serverStartTime
}: TurnTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isWarning, setIsWarning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTimedOut = useRef(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (isActive) {
      hasTimedOut.current = false;

      const calculateTimeLeft = () => {
        if (serverStartTime) {
          const elapsed = Math.floor((Date.now() - serverStartTime) / 1000);
          return Math.max(0, duration - elapsed);
        }
        return duration;
      };

      const initialTime = calculateTimeLeft();
      setTimeLeft(initialTime);
      setIsWarning(initialTime <= 5);

      intervalRef.current = setInterval(() => {
        const newTime = calculateTimeLeft();
        setTimeLeft(newTime);

        if (newTime <= 5) {
          setIsWarning(true);
        }

        if (newTime <= 0 && !hasTimedOut.current && isCurrentPlayer) {
          hasTimedOut.current = true;
          onTimeoutRef.current?.();
        }
      }, 250);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, duration, serverStartTime, isCurrentPlayer]);

  if (!isActive) return null;

  const percentage = (timeLeft / duration) * 100;
  const circumference = 2 * Math.PI * 16;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-2" data-testid="turn-timer">
      <div className="relative w-9 h-9">
        <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
          {/* Track */}
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            className="text-muted/40"
          />
          {/* Progress */}
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            strokeWidth={2.5}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn(
              "transition-all duration-1000 ease-linear",
              isWarning ? "stroke-[hsl(var(--team-red))]" : "stroke-[hsl(var(--gold))]"
            )}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums",
            isWarning ? "text-[hsl(var(--team-red))]" : "text-foreground/80"
          )}
          style={{
            fontFamily: 'var(--font-display)',
            ...(isWarning ? { animation: 'timer-urgent 0.5s ease-in-out infinite' } : {}),
          }}
        >
          {timeLeft}
        </span>
      </div>
      {playerName && (
        <span className={cn(
          "text-xs font-medium tracking-wide",
          isCurrentPlayer ? "text-[hsl(var(--gold))]" : "text-muted-foreground/60"
        )} style={{ fontFamily: 'var(--font-display)' }}>
          {isCurrentPlayer ? "Your turn" : `${playerName}'s turn`}
        </span>
      )}
    </div>
  );
}

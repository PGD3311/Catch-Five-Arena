import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

const GoldDivider = () => (
  <motion.div
    initial={{ scaleX: 0, opacity: 0 }}
    animate={{ scaleX: 1, opacity: 1 }}
    transition={{ delay: 0.2, duration: 0.5 }}
    className="mx-auto mt-2 mb-4 h-px w-3/4"
    style={{
      background: 'linear-gradient(90deg, transparent, hsl(42 82% 58% / 0.5), hsl(42 90% 72% / 0.7), hsl(42 82% 58% / 0.5), transparent)',
    }}
  />
);

const suitDecorations = ['\u2660', '\u2665', '\u2666', '\u2663', '\u2660', '\u2665', '\u2666', '\u2663'];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export function RulesModal({ open, onClose }: RulesModalProps) {
  const sections = [
    {
      title: 'Overview',
      suit: 0,
      content: (
        <p className="text-muted-foreground/90">
          Catch 5 is a 2v2 trick-taking card game. You and your Partner play against
          two Opponents. First team to 31 points wins!
        </p>
      ),
    },
    {
      title: 'The Deal',
      suit: 1,
      content: (
        <p className="text-muted-foreground/90">
          Each player receives 9 cards. The remaining cards form the stock pile.
        </p>
      ),
    },
    {
      title: 'Bidding (5-9)',
      suit: 2,
      content: (
        <ul className="list-disc list-inside space-y-1 text-muted-foreground/90">
          <li>Bid on how many of the 9 points your team will catch</li>
          <li>Bids must be between 5 and 9</li>
          <li>If everyone passes, the dealer must bid 5</li>
          <li>The highest bidder names trump and leads first</li>
        </ul>
      ),
    },
    {
      title: 'The Purge & Draw',
      suit: 3,
      content: (
        <>
          <p className="text-muted-foreground/90 mb-2">After trump is named:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground/90">
            <li>You must discard ALL non-trump cards from your hand</li>
            <li>If you have 9+ trumps, discard your lowest 3 trumps</li>
            <li>Draw from the stock until you have exactly 6 cards</li>
            <li>Cards drawn now are kept even if not trump</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Playing Tricks',
      suit: 4,
      content: (
        <ul className="list-disc list-inside space-y-1 text-muted-foreground/90">
          <li>The bidder leads the first card</li>
          <li>You must follow suit if possible</li>
          <li>If you cannot follow suit, play any card (trump to win)</li>
          <li>Highest trump wins, or highest card of led suit</li>
          <li>The trick winner leads the next trick</li>
        </ul>
      ),
    },
    {
      title: 'Scoring (9 Points Total)',
      suit: 5,
      content: (
        <ul className="space-y-1.5 text-muted-foreground/90">
          <li className="flex items-start gap-2">
            <span className="text-[hsl(var(--gold))] font-semibold text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--gold)/0.1)] border border-[hsl(var(--gold)/0.2)] shrink-0" style={{ fontFamily: 'var(--font-display)' }}>1 pt</span>
            <span><strong>High:</strong> Winning the highest trump played</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[hsl(var(--gold))] font-semibold text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--gold)/0.1)] border border-[hsl(var(--gold)/0.2)] shrink-0" style={{ fontFamily: 'var(--font-display)' }}>1 pt</span>
            <span><strong>Low:</strong> Winning the lowest trump played</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[hsl(var(--gold))] font-semibold text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--gold)/0.1)] border border-[hsl(var(--gold)/0.2)] shrink-0" style={{ fontFamily: 'var(--font-display)' }}>1 pt</span>
            <span><strong>Jack:</strong> Winning the Jack of trump</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[hsl(var(--gold))] font-semibold text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--gold)/0.1)] border border-[hsl(var(--gold)/0.2)] shrink-0" style={{ fontFamily: 'var(--font-display)' }}>5 pt</span>
            <span><strong>Five:</strong> Catching the 5 of trump!</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[hsl(var(--gold))] font-semibold text-xs px-1.5 py-0.5 rounded bg-[hsl(var(--gold)/0.1)] border border-[hsl(var(--gold)/0.2)] shrink-0" style={{ fontFamily: 'var(--font-display)' }}>1 pt</span>
            <span><strong>Game:</strong> Highest card point total (10=10, A=4, K=3, Q=2, J=1)</span>
          </li>
        </ul>
      ),
    },
    {
      title: 'Results',
      suit: 6,
      content: (
        <ul className="list-disc list-inside space-y-1 text-muted-foreground/90">
          <li><strong>Made it:</strong> Bidding team scores what they caught</li>
          <li><strong>Set:</strong> Bidding team loses their bid amount</li>
          <li>Opponents always score what they caught</li>
        </ul>
      ),
    },
    {
      title: 'Winning',
      suit: 7,
      content: (
        <p className="text-muted-foreground/90">
          First team to reach 31 points wins the game!
        </p>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] border-[hsl(var(--gold-dim)/0.15)] bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <DialogTitle className="text-2xl text-center gold-text" style={{ fontFamily: 'var(--font-display)' }}>
              How to Play Catch 5
            </DialogTitle>
          </motion.div>
          <GoldDivider />
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <motion.div
            className="space-y-5 text-sm leading-relaxed"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {sections.map((section, index) => (
              <motion.section
                key={section.title}
                variants={item}
                className="border-l-2 border-[hsl(var(--gold)/0.15)] pl-4"
              >
                <h3
                  className="text-lg font-semibold mb-2 text-[hsl(var(--gold))] flex items-center gap-2"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <span className="text-[hsl(var(--gold)/0.4)] text-xs">{suitDecorations[section.suit]}</span>
                  {section.title}
                </h3>
                {section.content}
              </motion.section>
            ))}
          </motion.div>
        </ScrollArea>

        <div className="pt-4">
          <Button
            onClick={onClose}
            className="w-full shadow-[0_0_20px_hsl(var(--gold)/0.15)]"
            style={{ fontFamily: 'var(--font-display)' }}
            data-testid="button-close-rules"
          >
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

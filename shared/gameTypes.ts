export type Suit = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
  id: string;
}

export interface Player {
  id: string;
  name: string;
  isHuman: boolean;
  hand: Card[];
  teamId: 'team1' | 'team2';
  bid: number | null;
  tricksWon: Card[];
  trumpCount?: number;
}

export interface Team {
  id: 'team1' | 'team2';
  name: string;
  score: number;
  playerIds: string[];
}

export type GamePhase = 'setup' | 'dealer-draw' | 'dealing' | 'bidding' | 'trump-selection' | 'purge-draw' | 'discard-trump' | 'playing' | 'scoring' | 'game-over';

export interface DealerDrawCard {
  playerId: string;
  card: Card;
}

export interface TrickCard {
  playerId: string;
  card: Card;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  teams: Team[];
  currentPlayerIndex: number;
  dealerIndex: number;
  trumpSuit: Suit | null;
  highBid: number;
  bidderId: string | null;
  currentTrick: TrickCard[];
  lastTrick?: TrickCard[];
  lastTrickWinnerId?: string | null;
  trickNumber: number;
  leadPlayerIndex: number;
  roundScores: Record<string, number>;
  roundScoreDetails?: RoundScoreDetails | null;
  deckColor: DeckColor;
  stock: Card[];
  discardPile: Card[];
  targetScore: number;
  dealerDrawCards?: DealerDrawCard[];
  autoClaimerId?: string | null;
  playersNeedingDiscard?: number[];
  sleptCards?: Card[];
}

export type DeckColor = 'red' | 'blue' | 'green' | 'purple' | 'gold' | 'black' | 'teal' | 'rose' | 'orange' | 'indigo' | 'crimson' | 'navy';

export const SUITS: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const CARD_VALUES: Record<Rank, number> = {
  '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0,
  '10': 10, 'J': 1, 'Q': 2, 'K': 3, 'A': 4
};

export const RANK_ORDER: Record<Rank, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7,
  '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12
};

export const RANK_ORDER_ACE_LOW: Record<Rank, number> = {
  'A': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7,
  '9': 8, '10': 9, 'J': 10, 'Q': 11, 'K': 12
};

export const DECK_COLORS: { value: DeckColor; label: string; gradient: string; cssGradient: string }[] = [
  { value: 'red', label: 'Classic Red', gradient: 'from-red-700 to-red-900', cssGradient: 'linear-gradient(135deg, #b91c1c, #7f1d1d)' },
  { value: 'blue', label: 'Royal Blue', gradient: 'from-blue-600 to-blue-900', cssGradient: 'linear-gradient(135deg, #2563eb, #1e3a8a)' },
  { value: 'green', label: 'Forest Green', gradient: 'from-emerald-600 to-emerald-900', cssGradient: 'linear-gradient(135deg, #059669, #064e3b)' },
  { value: 'purple', label: 'Royal Purple', gradient: 'from-purple-600 to-purple-900', cssGradient: 'linear-gradient(135deg, #9333ea, #581c87)' },
  { value: 'gold', label: 'Golden', gradient: 'from-amber-500 to-amber-700', cssGradient: 'linear-gradient(135deg, #f59e0b, #b45309)' },
  { value: 'black', label: 'Midnight', gradient: 'from-slate-700 to-slate-900', cssGradient: 'linear-gradient(135deg, #334155, #0f172a)' },
  { value: 'teal', label: 'Ocean Teal', gradient: 'from-teal-500 to-teal-800', cssGradient: 'linear-gradient(135deg, #14b8a6, #115e59)' },
  { value: 'rose', label: 'Rose Pink', gradient: 'from-rose-500 to-rose-800', cssGradient: 'linear-gradient(135deg, #f43f5e, #9f1239)' },
  { value: 'orange', label: 'Sunset', gradient: 'from-orange-500 to-orange-800', cssGradient: 'linear-gradient(135deg, #f97316, #9a3412)' },
  { value: 'indigo', label: 'Deep Indigo', gradient: 'from-indigo-500 to-indigo-900', cssGradient: 'linear-gradient(135deg, #6366f1, #312e81)' },
  { value: 'crimson', label: 'Crimson', gradient: 'from-red-600 to-rose-900', cssGradient: 'linear-gradient(135deg, #dc2626, #881337)' },
  { value: 'navy', label: 'Navy', gradient: 'from-blue-800 to-slate-900', cssGradient: 'linear-gradient(135deg, #1e40af, #0f172a)' },
];

export const MIN_BID = 5;
export const MAX_BID = 9;
export const INITIAL_HAND_SIZE = 9;
export const FINAL_HAND_SIZE = 6;
export const TOTAL_TRICKS = 6;
export const DEFAULT_TARGET_SCORE = 25;
export const TOTAL_POINTS_PER_ROUND = 9;

// Chat and emoji types
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'emoji';
  content: string;
  timestamp: number;
}

// Quick emoji reactions for card games
export const QUICK_EMOJIS = [
  { id: 'thumbsup', icon: 'ThumbsUp', label: 'Nice!' },
  { id: 'thumbsdown', icon: 'ThumbsDown', label: 'Oops' },
  { id: 'laugh', icon: 'Laugh', label: 'Ha!' },
  { id: 'angry', icon: 'Angry', label: 'Ugh' },
  { id: 'heart', icon: 'Heart', label: 'Love it' },
  { id: 'fire', icon: 'Flame', label: 'Hot!' },
  { id: 'clap', icon: 'HandMetal', label: 'GG' },
  { id: 'think', icon: 'Brain', label: 'Hmm...' },
] as const;

export type QuickEmojiId = typeof QUICK_EMOJIS[number]['id'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, id: `${rank}-${suit}` });
    }
  }
  return deck;
}

function cryptoRandom(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / (0xFFFFFFFF + 1);
  }
  return Math.random();
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let pass = 0; pass < 7; pass++) {
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(cryptoRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  }
  return shuffled;
}

export function getCardValue(card: Card): number {
  return CARD_VALUES[card.rank];
}

export function compareCards(a: Card, b: Card, trumpSuit: Suit | null, leadSuit: Suit): number {
  const aIsTrump = a.suit === trumpSuit;
  const bIsTrump = b.suit === trumpSuit;
  const aIsLead = a.suit === leadSuit;
  const bIsLead = b.suit === leadSuit;

  if (aIsTrump && !bIsTrump) return 1;
  if (!aIsTrump && bIsTrump) return -1;
  if (aIsTrump && bIsTrump) return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  if (aIsLead && !bIsLead) return 1;
  if (!aIsLead && bIsLead) return -1;
  if (aIsLead && bIsLead) return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  return 0;
}

export function determineTrickWinner(trick: TrickCard[], trumpSuit: Suit | null): string {
  if (trick.length === 0) return '';
  const leadSuit = trick[0].card.suit;
  let winner = trick[0];
  
  for (let i = 1; i < trick.length; i++) {
    if (compareCards(trick[i].card, winner.card, trumpSuit, leadSuit) > 0) {
      winner = trick[i];
    }
  }
  
  return winner.playerId;
}

export interface RoundScoreDetails {
  high: { teamId: string; card: Card } | null;
  low: { teamId: string; card: Card } | null;
  jack: { teamId: string } | null;
  five: { teamId: string } | null;
  game: { teamId: string; points: number } | null;
  teamPoints: Record<string, number>;
}

export function calculateRoundScores(
  players: Player[],
  teams: Team[],
  trumpSuit: Suit
): RoundScoreDetails {
  const allTrumps: { teamId: string; card: Card }[] = [];
  const gamePoints: Record<string, number> = {};
  
  for (const team of teams) {
    gamePoints[team.id] = 0;
  }

  for (const player of players) {
    for (const card of player.tricksWon) {
      if (card.suit === trumpSuit) {
        allTrumps.push({ teamId: player.teamId, card });
      }
      gamePoints[player.teamId] += getCardValue(card);
    }
  }

  const result: RoundScoreDetails = {
    high: null,
    low: null,
    jack: null,
    five: null,
    game: null,
    teamPoints: { team1: 0, team2: 0 },
  };

  if (allTrumps.length > 0) {
    allTrumps.sort((a, b) => RANK_ORDER[a.card.rank] - RANK_ORDER[b.card.rank]);
    
    result.low = { teamId: allTrumps[0].teamId, card: allTrumps[0].card };
    result.teamPoints[result.low.teamId] += 1;
    
    result.high = { teamId: allTrumps[allTrumps.length - 1].teamId, card: allTrumps[allTrumps.length - 1].card };
    result.teamPoints[result.high.teamId] += 1;

    const jack = allTrumps.find(t => t.card.rank === 'J');
    if (jack) {
      result.jack = { teamId: jack.teamId };
      result.teamPoints[jack.teamId] += 1;
    }

    const five = allTrumps.find(t => t.card.rank === '5');
    if (five) {
      result.five = { teamId: five.teamId };
      result.teamPoints[five.teamId] += 5;
    }
  }

  const team1Points = gamePoints['team1'];
  const team2Points = gamePoints['team2'];
  
  if (team1Points > team2Points) {
    result.game = { teamId: 'team1', points: team1Points };
    result.teamPoints['team1'] += 1;
  } else if (team2Points > team1Points) {
    result.game = { teamId: 'team2', points: team2Points };
    result.teamPoints['team2'] += 1;
  }

  return result;
}

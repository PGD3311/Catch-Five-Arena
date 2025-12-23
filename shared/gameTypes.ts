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
  score: number;
  bid: number | null;
  tricksWon: Card[];
}

export type GamePhase = 'setup' | 'dealing' | 'bidding' | 'trump-selection' | 'playing' | 'scoring' | 'game-over';

export interface TrickCard {
  playerId: string;
  card: Card;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  trumpSuit: Suit | null;
  highBid: number;
  bidderId: string | null;
  currentTrick: TrickCard[];
  trickNumber: number;
  leadPlayerIndex: number;
  roundScores: Record<string, number>;
  deckColor: DeckColor;
}

export type DeckColor = 'red' | 'blue' | 'green' | 'purple' | 'gold' | 'black';

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

export const DECK_COLORS: { value: DeckColor; label: string; gradient: string }[] = [
  { value: 'red', label: 'Classic Red', gradient: 'from-red-700 to-red-900' },
  { value: 'blue', label: 'Royal Blue', gradient: 'from-blue-600 to-blue-900' },
  { value: 'green', label: 'Forest Green', gradient: 'from-emerald-600 to-emerald-900' },
  { value: 'purple', label: 'Royal Purple', gradient: 'from-purple-600 to-purple-900' },
  { value: 'gold', label: 'Golden', gradient: 'from-amber-500 to-amber-700' },
  { value: 'black', label: 'Midnight', gradient: 'from-slate-700 to-slate-900' },
];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, id: `${rank}-${suit}` });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
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

export function calculateRoundScores(players: Player[], trumpSuit: Suit): Record<string, { points: number; details: string[] }> {
  const scores: Record<string, { points: number; details: string[] }> = {};
  const allTrumps: { playerId: string; card: Card }[] = [];
  const gamePoints: Record<string, number> = {};

  for (const player of players) {
    scores[player.id] = { points: 0, details: [] };
    gamePoints[player.id] = 0;

    for (const card of player.tricksWon) {
      if (card.suit === trumpSuit) {
        allTrumps.push({ playerId: player.id, card });
        if (card.rank === '5') {
          scores[player.id].points += 5;
          scores[player.id].details.push('Caught the 5! (+5)');
        }
        if (card.rank === 'J') {
          scores[player.id].points += 1;
          scores[player.id].details.push('Won the Jack (+1)');
        }
      }
      gamePoints[player.id] += getCardValue(card);
    }
  }

  if (allTrumps.length > 0) {
    allTrumps.sort((a, b) => RANK_ORDER[a.card.rank] - RANK_ORDER[b.card.rank]);
    const lowWinner = allTrumps[0].playerId;
    const highWinner = allTrumps[allTrumps.length - 1].playerId;

    scores[highWinner].points += 1;
    scores[highWinner].details.push('Won High (+1)');
    scores[lowWinner].points += 1;
    scores[lowWinner].details.push('Won Low (+1)');
  }

  let maxGamePoints = -1;
  let gameWinner: string | null = null;
  for (const [playerId, pts] of Object.entries(gamePoints)) {
    if (pts > maxGamePoints) {
      maxGamePoints = pts;
      gameWinner = playerId;
    } else if (pts === maxGamePoints) {
      gameWinner = null;
    }
  }

  if (gameWinner) {
    scores[gameWinner].points += 1;
    scores[gameWinner].details.push(`Won Game (${maxGamePoints} pts) (+1)`);
  }

  return scores;
}

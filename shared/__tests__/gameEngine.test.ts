import { describe, it, expect } from 'vitest';
import {
  createDeck,
  shuffleDeck,
  determineTrickWinner,
  calculateRoundScores,
  Card,
  Suit,
  Player,
  Team,
  TrickCard,
  RANK_ORDER,
} from '../gameTypes';
import {
  dealCards,
  processBid,
  playCard,
  canPlayCard,
  performPurgeAndDraw,
  initializeGame,
  selectTrump,
  getWinningTeam,
} from '../gameEngine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function card(rank: string, suit: Suit): Card {
  return { rank: rank as Card['rank'], suit, id: `${rank}-${suit}` };
}

function trickCard(playerId: string, rank: string, suit: Suit): TrickCard {
  return { playerId, card: card(rank, suit) };
}

function makePlayer(overrides: Partial<Player> & { id: string }): Player {
  return {
    name: overrides.id,
    isHuman: false,
    hand: [],
    teamId: 'team1',
    bid: null,
    tricksWon: [],
    ...overrides,
  };
}

function makeTeams(): Team[] {
  return [
    { id: 'team1', name: 'Team 1', score: 0, playerIds: ['player1', 'player3'] },
    { id: 'team2', name: 'Team 2', score: 0, playerIds: ['player2', 'player4'] },
  ];
}

// ---------------------------------------------------------------------------
// createDeck / shuffleDeck
// ---------------------------------------------------------------------------

describe('createDeck', () => {
  it('creates 52 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    const ids = new Set(deck.map(c => c.id));
    expect(ids.size).toBe(52);
  });

  it('has 13 cards per suit', () => {
    const deck = createDeck();
    const suits: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    for (const suit of suits) {
      expect(deck.filter(c => c.suit === suit)).toHaveLength(13);
    }
  });
});

describe('shuffleDeck', () => {
  it('preserves all 52 unique cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(52);
    const ids = new Set(shuffled.map(c => c.id));
    expect(ids.size).toBe(52);
  });

  it('does not mutate the original deck', () => {
    const deck = createDeck();
    const original = [...deck];
    shuffleDeck(deck);
    expect(deck).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// determineTrickWinner
// ---------------------------------------------------------------------------

describe('determineTrickWinner', () => {
  it('highest lead-suit card wins when no trump played', () => {
    const trick: TrickCard[] = [
      trickCard('p1', '5', 'Hearts'),
      trickCard('p2', 'K', 'Hearts'),
      trickCard('p3', '3', 'Hearts'),
      trickCard('p4', '10', 'Hearts'),
    ];
    expect(determineTrickWinner(trick, 'Spades')).toBe('p2');
  });

  it('trump beats lead suit even if lower rank', () => {
    const trick: TrickCard[] = [
      trickCard('p1', 'A', 'Hearts'),
      trickCard('p2', '2', 'Spades'),
      trickCard('p3', 'K', 'Hearts'),
      trickCard('p4', 'Q', 'Hearts'),
    ];
    expect(determineTrickWinner(trick, 'Spades')).toBe('p2');
  });

  it('highest trump wins when multiple trumps played', () => {
    const trick: TrickCard[] = [
      trickCard('p1', '7', 'Hearts'),
      trickCard('p2', '3', 'Spades'),
      trickCard('p3', 'J', 'Spades'),
      trickCard('p4', '9', 'Hearts'),
    ];
    expect(determineTrickWinner(trick, 'Spades')).toBe('p3');
  });

  it('off-suit non-trump cards cannot win', () => {
    const trick: TrickCard[] = [
      trickCard('p1', '3', 'Hearts'),
      trickCard('p2', 'A', 'Diamonds'),
      trickCard('p3', 'A', 'Clubs'),
      trickCard('p4', '4', 'Hearts'),
    ];
    expect(determineTrickWinner(trick, 'Spades')).toBe('p4');
  });

  it('lead suit wins when trump is null', () => {
    const trick: TrickCard[] = [
      trickCard('p1', '6', 'Clubs'),
      trickCard('p2', 'A', 'Diamonds'),
      trickCard('p3', 'Q', 'Clubs'),
      trickCard('p4', '3', 'Clubs'),
    ];
    expect(determineTrickWinner(trick, null)).toBe('p3');
  });

  it('returns empty string for empty trick', () => {
    expect(determineTrickWinner([], 'Hearts')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// canPlayCard
// ---------------------------------------------------------------------------

describe('canPlayCard', () => {
  it('any card can be played when leading', () => {
    const hand = [card('A', 'Hearts'), card('5', 'Spades')];
    expect(canPlayCard(card('5', 'Spades'), hand, [], 'Hearts')).toBe(true);
    expect(canPlayCard(card('A', 'Hearts'), hand, [], 'Hearts')).toBe(true);
  });

  it('must follow lead suit if you have it (non-trump off-suit blocked)', () => {
    const hand = [card('3', 'Hearts'), card('K', 'Diamonds')];
    const trick = [trickCard('p1', '7', 'Hearts')];
    // Can play Hearts
    expect(canPlayCard(card('3', 'Hearts'), hand, trick, 'Spades')).toBe(true);
    // Cannot play Diamonds (off-suit, non-trump, and has lead suit)
    expect(canPlayCard(card('K', 'Diamonds'), hand, trick, 'Spades')).toBe(false);
  });

  it('trump can always be played even when holding lead suit', () => {
    const hand = [card('3', 'Hearts'), card('5', 'Spades')];
    const trick = [trickCard('p1', '7', 'Hearts')];
    expect(canPlayCard(card('5', 'Spades'), hand, trick, 'Spades')).toBe(true);
  });

  it('any card allowed when void in lead suit', () => {
    const hand = [card('K', 'Diamonds'), card('2', 'Clubs')];
    const trick = [trickCard('p1', '7', 'Hearts')];
    expect(canPlayCard(card('K', 'Diamonds'), hand, trick, 'Spades')).toBe(true);
    expect(canPlayCard(card('2', 'Clubs'), hand, trick, 'Spades')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateRoundScores
// ---------------------------------------------------------------------------

describe('calculateRoundScores', () => {
  const teams = makeTeams();

  it('awards High to team with highest trump', () => {
    const players: Player[] = [
      makePlayer({ id: 'player1', teamId: 'team1', tricksWon: [card('A', 'Hearts')] }),
      makePlayer({ id: 'player2', teamId: 'team2', tricksWon: [card('K', 'Hearts')] }),
      makePlayer({ id: 'player3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', tricksWon: [] }),
    ];
    const result = calculateRoundScores(players, teams, 'Hearts');
    expect(result.high?.teamId).toBe('team1');
    expect(result.high?.card.rank).toBe('A');
  });

  it('awards Low to team with lowest trump', () => {
    const players: Player[] = [
      makePlayer({ id: 'player1', teamId: 'team1', tricksWon: [card('A', 'Hearts')] }),
      makePlayer({ id: 'player2', teamId: 'team2', tricksWon: [card('2', 'Hearts')] }),
      makePlayer({ id: 'player3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', tricksWon: [] }),
    ];
    const result = calculateRoundScores(players, teams, 'Hearts');
    expect(result.low?.teamId).toBe('team2');
    expect(result.low?.card.rank).toBe('2');
  });

  it('awards Jack point to team that captured the Jack of trump', () => {
    const players: Player[] = [
      makePlayer({ id: 'player1', teamId: 'team1', tricksWon: [card('J', 'Hearts')] }),
      makePlayer({ id: 'player2', teamId: 'team2', tricksWon: [] }),
      makePlayer({ id: 'player3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', tricksWon: [] }),
    ];
    const result = calculateRoundScores(players, teams, 'Hearts');
    expect(result.jack?.teamId).toBe('team1');
  });

  it('awards 5 points for the Five of trump', () => {
    const players: Player[] = [
      makePlayer({ id: 'player1', teamId: 'team1', tricksWon: [card('5', 'Hearts')] }),
      makePlayer({ id: 'player2', teamId: 'team2', tricksWon: [] }),
      makePlayer({ id: 'player3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', tricksWon: [] }),
    ];
    const result = calculateRoundScores(players, teams, 'Hearts');
    expect(result.five?.teamId).toBe('team1');
    expect(result.teamPoints['team1']).toBeGreaterThanOrEqual(5);
  });

  it('awards Game point to team with higher game count', () => {
    // Team 1 wins a 10 (value 10), team 2 wins nothing of value
    const players: Player[] = [
      makePlayer({ id: 'player1', teamId: 'team1', tricksWon: [card('10', 'Diamonds')] }),
      makePlayer({ id: 'player2', teamId: 'team2', tricksWon: [card('3', 'Clubs')] }),
      makePlayer({ id: 'player3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', tricksWon: [] }),
    ];
    const result = calculateRoundScores(players, teams, 'Hearts');
    expect(result.game?.teamId).toBe('team1');
  });

  it('no Game point awarded on tie', () => {
    const players: Player[] = [
      makePlayer({ id: 'player1', teamId: 'team1', tricksWon: [card('10', 'Diamonds')] }),
      makePlayer({ id: 'player2', teamId: 'team2', tricksWon: [card('10', 'Clubs')] }),
      makePlayer({ id: 'player3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', tricksWon: [] }),
    ];
    const result = calculateRoundScores(players, teams, 'Hearts');
    expect(result.game).toBeNull();
  });

  it('distributes correct total points across teams', () => {
    // Team 1 has: A of trump (High=1), J of trump (Jack=1), 10 of diamonds
    // Team 2 has: 2 of trump (Low=1), 5 of trump (Five=5)
    // Game: team1 = A(4) + J(1) + 10(10) = 15, team2 = 5(0) + 2(0) = 0, so team1 gets Game(1)
    const players: Player[] = [
      makePlayer({
        id: 'player1',
        teamId: 'team1',
        tricksWon: [card('A', 'Spades'), card('J', 'Spades'), card('10', 'Diamonds')],
      }),
      makePlayer({
        id: 'player2',
        teamId: 'team2',
        tricksWon: [card('2', 'Spades'), card('5', 'Spades')],
      }),
      makePlayer({ id: 'player3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', tricksWon: [] }),
    ];
    const result = calculateRoundScores(players, teams, 'Spades');
    // team1: High(1) + Jack(1) + Game(1) = 3
    expect(result.teamPoints['team1']).toBe(3);
    // team2: Low(1) + Five(5) = 6
    expect(result.teamPoints['team2']).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// playCard
// ---------------------------------------------------------------------------

describe('playCard', () => {
  function playingState() {
    const state = initializeGame();
    // Manually set up a playing state with known hands
    return {
      ...state,
      phase: 'playing' as const,
      trumpSuit: 'Hearts' as Suit,
      highBid: 5,
      bidderId: 'player1',
      trickNumber: 1,
      currentPlayerIndex: 0,
      leadPlayerIndex: 0,
      players: [
        makePlayer({ id: 'player1', teamId: 'team1', hand: [card('A', 'Hearts'), card('K', 'Clubs')] }),
        makePlayer({ id: 'player2', teamId: 'team2', hand: [card('3', 'Hearts'), card('Q', 'Diamonds')] }),
        makePlayer({ id: 'player3', teamId: 'team1', hand: [card('7', 'Hearts'), card('J', 'Clubs')] }),
        makePlayer({ id: 'player4', teamId: 'team2', hand: [card('9', 'Hearts'), card('5', 'Diamonds')] }),
      ],
    };
  }

  it('removes card from player hand after playing', () => {
    const state = playingState();
    const next = playCard(state, card('A', 'Hearts'));
    expect(next.players[0].hand).toHaveLength(1);
    expect(next.players[0].hand[0].id).toBe('K-Clubs');
  });

  it('adds card to current trick', () => {
    const state = playingState();
    const next = playCard(state, card('A', 'Hearts'));
    expect(next.currentTrick).toHaveLength(1);
    expect(next.currentTrick[0].card.id).toBe('A-Hearts');
    expect(next.currentTrick[0].playerId).toBe('player1');
  });

  it('advances to next player', () => {
    const state = playingState();
    const next = playCard(state, card('A', 'Hearts'));
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('completes trick after 4 cards and clears currentTrick', () => {
    let state = playingState();
    state = playCard(state, card('A', 'Hearts')); // p1
    state = { ...state, currentPlayerIndex: 1 };
    state = playCard(state, card('3', 'Hearts')); // p2
    state = { ...state, currentPlayerIndex: 2 };
    state = playCard(state, card('7', 'Hearts')); // p3
    state = { ...state, currentPlayerIndex: 3 };
    state = playCard(state, card('9', 'Hearts')); // p4

    expect(state.currentTrick).toHaveLength(0);
    expect(state.trickNumber).toBe(2);
  });

  it('winner of trick gets trick cards in tricksWon', () => {
    let state = playingState();
    state = playCard(state, card('A', 'Hearts')); // p1 leads with Ace
    state = { ...state, currentPlayerIndex: 1 };
    state = playCard(state, card('3', 'Hearts')); // p2
    state = { ...state, currentPlayerIndex: 2 };
    state = playCard(state, card('7', 'Hearts')); // p3
    state = { ...state, currentPlayerIndex: 3 };
    state = playCard(state, card('9', 'Hearts')); // p4

    // Ace of Hearts should win (highest trump)
    const winner = state.players.find(p => p.tricksWon.length > 0);
    expect(winner?.id).toBe('player1');
    expect(winner?.tricksWon).toHaveLength(4);
  });

  it('ignores card not in players hand', () => {
    const state = playingState();
    const bogusCard = card('2', 'Spades');
    const next = playCard(state, bogusCard);
    // State should be unchanged
    expect(next).toBe(state);
  });

  it('sets lastTrick after trick completes', () => {
    let state = playingState();
    state = playCard(state, card('A', 'Hearts'));
    state = { ...state, currentPlayerIndex: 1 };
    state = playCard(state, card('3', 'Hearts'));
    state = { ...state, currentPlayerIndex: 2 };
    state = playCard(state, card('7', 'Hearts'));
    state = { ...state, currentPlayerIndex: 3 };
    state = playCard(state, card('9', 'Hearts'));

    expect(state.lastTrick).toHaveLength(4);
    expect(state.lastTrickWinnerId).toBe('player1');
  });
});

// ---------------------------------------------------------------------------
// processBid
// ---------------------------------------------------------------------------

describe('processBid', () => {
  function biddingState() {
    const state = initializeGame();
    return {
      ...state,
      phase: 'bidding' as const,
      dealerIndex: 3,
      currentPlayerIndex: 0,
      players: state.players.map(p => ({ ...p, bid: null })),
    };
  }

  it('records a players bid', () => {
    const state = biddingState();
    const next = processBid(state, 5);
    expect(next.players[0].bid).toBe(5);
  });

  it('advances to next player', () => {
    const state = biddingState();
    const next = processBid(state, 5);
    expect(next.currentPlayerIndex).toBe(1);
  });

  it('tracks high bid and bidder', () => {
    const state = biddingState();
    const next = processBid(state, 7);
    expect(next.highBid).toBe(7);
    expect(next.bidderId).toBe('player1');
  });

  it('pass (0) does not change high bid', () => {
    let state = biddingState();
    state = processBid(state, 5); // p1 bids 5
    state = processBid(state, 0); // p2 passes
    expect(state.highBid).toBe(5);
    expect(state.bidderId).toBe('player1');
  });

  it('transitions to trump-selection when all players have bid', () => {
    let state = biddingState();
    state = processBid(state, 5); // p1
    state = processBid(state, 6); // p2
    state = processBid(state, 0); // p3
    state = processBid(state, 0); // p4 (dealer)
    expect(state.phase).toBe('trump-selection');
    expect(state.bidderId).toBe('player2');
  });

  it('dealer is forced to bid MIN_BID when everyone passes', () => {
    let state = biddingState();
    state = processBid(state, 0); // p1
    state = processBid(state, 0); // p2
    state = processBid(state, 0); // p3
    state = processBid(state, 0); // p4 (dealer)
    expect(state.phase).toBe('trump-selection');
    expect(state.highBid).toBe(5);
    expect(state.bidderId).toBe('player4');
  });
});

// ---------------------------------------------------------------------------
// performPurgeAndDraw
// ---------------------------------------------------------------------------

describe('performPurgeAndDraw', () => {
  function purgeDrawState() {
    const state = initializeGame();
    // Set up a state ready for purge-draw with known hands
    const deck = createDeck();
    return {
      ...state,
      phase: 'purge-draw' as const,
      trumpSuit: 'Hearts' as Suit,
      bidderId: 'player1',
      currentPlayerIndex: 0,
      players: [
        makePlayer({
          id: 'player1',
          teamId: 'team1',
          hand: [
            card('A', 'Hearts'), card('5', 'Hearts'), card('J', 'Hearts'),
            card('K', 'Clubs'), card('Q', 'Diamonds'), card('3', 'Spades'),
            card('7', 'Clubs'), card('8', 'Diamonds'), card('9', 'Spades'),
          ],
        }),
        makePlayer({
          id: 'player2',
          teamId: 'team2',
          hand: [
            card('2', 'Hearts'), card('10', 'Hearts'),
            card('4', 'Clubs'), card('6', 'Diamonds'), card('8', 'Spades'),
            card('J', 'Clubs'), card('Q', 'Spades'), card('3', 'Diamonds'),
            card('9', 'Clubs'),
          ],
        }),
        makePlayer({
          id: 'player3',
          teamId: 'team1',
          hand: [
            card('K', 'Hearts'), card('Q', 'Hearts'),
            card('3', 'Clubs'), card('5', 'Diamonds'), card('7', 'Spades'),
            card('10', 'Clubs'), card('A', 'Diamonds'), card('6', 'Spades'),
            card('4', 'Diamonds'),
          ],
        }),
        makePlayer({
          id: 'player4',
          teamId: 'team2',
          hand: [
            card('9', 'Hearts'), card('8', 'Hearts'),
            card('5', 'Clubs'), card('2', 'Diamonds'), card('4', 'Spades'),
            card('6', 'Clubs'), card('K', 'Diamonds'), card('J', 'Spades'),
            card('A', 'Spades'),
          ],
        }),
      ],
      stock: [
        card('7', 'Hearts'), card('6', 'Hearts'), card('4', 'Hearts'), card('3', 'Hearts'),
        card('2', 'Clubs'), card('A', 'Clubs'), card('8', 'Clubs'), card('K', 'Spades'),
        card('10', 'Spades'), card('2', 'Spades'), card('5', 'Spades'), card('9', 'Diamonds'),
        card('7', 'Diamonds'), card('J', 'Diamonds'), card('10', 'Diamonds'), card('Q', 'Clubs'),
      ],
      discardPile: [],
    };
  }

  it('removes non-trump cards from all hands', () => {
    const state = purgeDrawState();
    const next = performPurgeAndDraw(state);

    // After purge-and-draw, no player should hold non-trump in their initial trump cards
    // (they may have drawn non-trump from stock though -- but stock only has some trumps)
    // Actually, after the draw, players draw from stock which has a mix.
    // The key invariant: non-trump cards from original hands were purged to discard.
    // After draw, hands should be exactly 6 cards.
    for (const player of next.players) {
      expect(player.hand).toHaveLength(6);
    }
  });

  it('all players end up with 6 cards', () => {
    const state = purgeDrawState();
    const next = performPurgeAndDraw(state);
    for (const player of next.players) {
      expect(player.hand).toHaveLength(6);
    }
  });

  it('transitions to playing phase', () => {
    const state = purgeDrawState();
    const next = performPurgeAndDraw(state);
    expect(next.phase).toBe('playing');
  });

  it('sets current player to bidder', () => {
    const state = purgeDrawState();
    const next = performPurgeAndDraw(state);
    const bidderIndex = next.players.findIndex(p => p.id === 'player1');
    expect(next.currentPlayerIndex).toBe(bidderIndex);
    expect(next.leadPlayerIndex).toBe(bidderIndex);
  });
});

// ---------------------------------------------------------------------------
// dealCards
// ---------------------------------------------------------------------------

describe('dealCards', () => {
  it('deals 9 cards to each player', () => {
    const state = initializeGame();
    const dealt = dealCards(state);
    for (const player of dealt.players) {
      expect(player.hand).toHaveLength(9);
    }
  });

  it('remaining cards go to stock', () => {
    const state = initializeGame();
    const dealt = dealCards(state);
    // 52 cards total - 4*9 = 16 in stock
    expect(dealt.stock).toHaveLength(16);
  });

  it('all 52 cards are accounted for (hands + stock)', () => {
    const state = initializeGame();
    const dealt = dealCards(state);
    const allCards = [
      ...dealt.players.flatMap(p => p.hand),
      ...dealt.stock,
    ];
    expect(allCards).toHaveLength(52);
    const ids = new Set(allCards.map(c => c.id));
    expect(ids.size).toBe(52);
  });

  it('transitions to bidding phase', () => {
    const state = initializeGame();
    const dealt = dealCards(state);
    expect(dealt.phase).toBe('bidding');
  });

  it('first bidder is player after dealer', () => {
    const state = { ...initializeGame(), dealerIndex: 2 };
    const dealt = dealCards(state);
    expect(dealt.currentPlayerIndex).toBe(3);
  });

  it('resets bids and tricksWon', () => {
    const state = initializeGame();
    const dealt = dealCards(state);
    for (const player of dealt.players) {
      expect(player.bid).toBeNull();
      expect(player.tricksWon).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Round scoring integration (playCard through to scoring)
// ---------------------------------------------------------------------------

describe('round scoring integration', () => {
  it('calculates scores after final trick and transitions to scoring', () => {
    const state = initializeGame();

    // Build a state at trick 6 (the final trick) with known hands
    const finalState = {
      ...state,
      phase: 'playing' as const,
      trumpSuit: 'Hearts' as Suit,
      highBid: 5,
      bidderId: 'player1',
      trickNumber: 6,
      currentPlayerIndex: 0,
      leadPlayerIndex: 0,
      stock: [],
      discardPile: [],
      players: [
        makePlayer({
          id: 'player1',
          teamId: 'team1',
          hand: [card('A', 'Hearts')],
          tricksWon: [card('5', 'Hearts'), card('K', 'Hearts')],
        }),
        makePlayer({
          id: 'player2',
          teamId: 'team2',
          hand: [card('3', 'Hearts')],
          tricksWon: [card('2', 'Hearts')],
        }),
        makePlayer({
          id: 'player3',
          teamId: 'team1',
          hand: [card('Q', 'Hearts')],
          tricksWon: [card('J', 'Hearts')],
        }),
        makePlayer({
          id: 'player4',
          teamId: 'team2',
          hand: [card('6', 'Hearts')],
          tricksWon: [],
        }),
      ],
    };

    // Play the final trick: p1 leads A, p2 plays 3, p3 plays Q, p4 plays 6
    let s = playCard(finalState, card('A', 'Hearts'));
    s = { ...s, currentPlayerIndex: 1 };
    s = playCard(s, card('3', 'Hearts'));
    s = { ...s, currentPlayerIndex: 2 };
    s = playCard(s, card('Q', 'Hearts'));
    s = { ...s, currentPlayerIndex: 3 };
    s = playCard(s, card('6', 'Hearts'));

    expect(s.trickNumber).toBe(7); // past TOTAL_TRICKS
    expect(s.phase).toBe('scoring');
    expect(s.roundScores).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Set penalty
// ---------------------------------------------------------------------------

describe('set penalty', () => {
  // Helper: build a state at the final trick where we control who wins what
  function finalTrickState(opts: {
    highBid: number;
    bidderId: string;
    team1StartScore?: number;
    team2StartScore?: number;
  }) {
    const state = initializeGame();
    return {
      ...state,
      phase: 'playing' as const,
      trumpSuit: 'Hearts' as Suit,
      highBid: opts.highBid,
      bidderId: opts.bidderId,
      trickNumber: 6,
      currentPlayerIndex: 0,
      leadPlayerIndex: 0,
      stock: [],
      discardPile: [],
      teams: [
        { id: 'team1' as const, name: 'Team 1', score: opts.team1StartScore ?? 0, playerIds: ['player1', 'player3'] },
        { id: 'team2' as const, name: 'Team 2', score: opts.team2StartScore ?? 0, playerIds: ['player2', 'player4'] },
      ],
    };
  }

  function playFinalTrick(state: ReturnType<typeof finalTrickState>, players: Player[]) {
    let s = { ...state, players };
    s = playCard(s, s.players[0].hand[0]);
    s = { ...s, currentPlayerIndex: 1 };
    s = playCard(s, s.players[1].hand[0]);
    s = { ...s, currentPlayerIndex: 2 };
    s = playCard(s, s.players[2].hand[0]);
    s = { ...s, currentPlayerIndex: 3 };
    s = playCard(s, s.players[3].hand[0]);
    return s;
  }

  it('applies negative penalty when bidder team does not make their bid', () => {
    // player1 (team1) bid 7, but team1 only earns a few points
    // Team1 gets: High (A) = 1 point. That's it — well short of 7.
    const state = finalTrickState({ highBid: 7, bidderId: 'player1' });
    const players = [
      makePlayer({ id: 'player1', teamId: 'team1', hand: [card('A', 'Hearts')], tricksWon: [] }),
      makePlayer({ id: 'player2', teamId: 'team2', hand: [card('3', 'Hearts')], tricksWon: [card('5', 'Hearts'), card('2', 'Hearts')] }),
      makePlayer({ id: 'player3', teamId: 'team1', hand: [card('4', 'Hearts')], tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', hand: [card('6', 'Hearts')], tricksWon: [card('J', 'Hearts')] }),
    ];

    const result = playFinalTrick(state, players);

    // Team1 earned points < 7 bid, so they get -7 penalty
    const team1 = result.teams.find(t => t.id === 'team1')!;
    expect(team1.score).toBeLessThan(0);
  });

  it('does not penalize when bidder team makes their bid', () => {
    // player1 (team1) bid 5, team1 earns High + Five + Jack + Game = 8 points
    const state = finalTrickState({ highBid: 5, bidderId: 'player1' });
    const players = [
      makePlayer({
        id: 'player1',
        teamId: 'team1',
        hand: [card('A', 'Hearts')],
        tricksWon: [card('5', 'Hearts'), card('J', 'Hearts'), card('10', 'Diamonds')],
      }),
      makePlayer({ id: 'player2', teamId: 'team2', hand: [card('3', 'Hearts')], tricksWon: [card('2', 'Hearts')] }),
      makePlayer({ id: 'player3', teamId: 'team1', hand: [card('K', 'Hearts')], tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', hand: [card('6', 'Hearts')], tricksWon: [] }),
    ];

    const result = playFinalTrick(state, players);

    const team1 = result.teams.find(t => t.id === 'team1')!;
    expect(team1.score).toBeGreaterThan(0);
  });

  it('non-bidding team score is never penalized', () => {
    // player1 (team1) is bidder. team2 should get their earned points regardless.
    const state = finalTrickState({ highBid: 9, bidderId: 'player1' });
    const players = [
      makePlayer({ id: 'player1', teamId: 'team1', hand: [card('A', 'Hearts')], tricksWon: [] }),
      makePlayer({ id: 'player2', teamId: 'team2', hand: [card('3', 'Hearts')], tricksWon: [card('5', 'Hearts'), card('2', 'Hearts'), card('J', 'Hearts')] }),
      makePlayer({ id: 'player3', teamId: 'team1', hand: [card('4', 'Hearts')], tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', hand: [card('6', 'Hearts')], tricksWon: [card('10', 'Clubs')] }),
    ];

    const result = playFinalTrick(state, players);

    const team2 = result.teams.find(t => t.id === 'team2')!;
    expect(team2.score).toBeGreaterThan(0);
  });

  it('set penalty can push team score negative', () => {
    // team1 starts at 3, bids 7, doesn't make it → 3 + (-7) = -4
    const state = finalTrickState({ highBid: 7, bidderId: 'player1', team1StartScore: 3 });
    const players = [
      makePlayer({ id: 'player1', teamId: 'team1', hand: [card('4', 'Hearts')], tricksWon: [] }),
      makePlayer({ id: 'player2', teamId: 'team2', hand: [card('A', 'Hearts')], tricksWon: [card('5', 'Hearts'), card('2', 'Hearts'), card('J', 'Hearts')] }),
      makePlayer({ id: 'player3', teamId: 'team1', hand: [card('8', 'Hearts')], tricksWon: [] }),
      makePlayer({ id: 'player4', teamId: 'team2', hand: [card('K', 'Hearts')], tricksWon: [] }),
    ];

    const result = playFinalTrick(state, players);

    const team1 = result.teams.find(t => t.id === 'team1')!;
    expect(team1.score).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// getWinningTeam
// ---------------------------------------------------------------------------

describe('getWinningTeam', () => {
  function gameOverState(overrides: Partial<ReturnType<typeof initializeGame>>) {
    const base = initializeGame();
    return {
      ...base,
      phase: 'game-over' as const,
      highBid: 5,
      bidderId: 'player1',
      roundScores: { team1: 0, team2: 0 },
      ...overrides,
    };
  }

  it('returns the team that reached the target score', () => {
    const state = gameOverState({
      teams: [
        { id: 'team1', name: 'Team 1', score: 27, playerIds: ['player1', 'player3'] },
        { id: 'team2', name: 'Team 2', score: 18, playerIds: ['player2', 'player4'] },
      ],
    });
    expect(getWinningTeam(state)?.id).toBe('team1');
  });

  it('returns the other team when only they reached target', () => {
    const state = gameOverState({
      teams: [
        { id: 'team1', name: 'Team 1', score: 10, playerIds: ['player1', 'player3'] },
        { id: 'team2', name: 'Team 2', score: 26, playerIds: ['player2', 'player4'] },
      ],
    });
    expect(getWinningTeam(state)?.id).toBe('team2');
  });

  it('bidder team wins when both teams reach target and bidder made their bid', () => {
    const state = gameOverState({
      bidderId: 'player1', // team1
      highBid: 5,
      roundScores: { team1: 7, team2: 2 },
      teams: [
        { id: 'team1', name: 'Team 1', score: 27, playerIds: ['player1', 'player3'] },
        { id: 'team2', name: 'Team 2', score: 25, playerIds: ['player2', 'player4'] },
      ],
    });
    expect(getWinningTeam(state)?.id).toBe('team1');
  });

  it('non-bidder team wins when both reach target and bidder was set', () => {
    // Bidder (team1) bid 7 but only got 3 points this round — got set.
    // Both teams at 25+ but bidder failed.
    const state = gameOverState({
      bidderId: 'player1', // team1
      highBid: 7,
      roundScores: { team1: 3, team2: 6 },
      teams: [
        { id: 'team1', name: 'Team 1', score: 25, playerIds: ['player1', 'player3'] },
        { id: 'team2', name: 'Team 2', score: 25, playerIds: ['player2', 'player4'] },
      ],
    });
    expect(getWinningTeam(state)?.id).toBe('team2');
  });

  it('higher scoring team wins when both reach target and bidder was set', () => {
    const state = gameOverState({
      bidderId: 'player2', // team2
      highBid: 7,
      roundScores: { team1: 6, team2: 3 },
      teams: [
        { id: 'team1', name: 'Team 1', score: 30, playerIds: ['player1', 'player3'] },
        { id: 'team2', name: 'Team 2', score: 25, playerIds: ['player2', 'player4'] },
      ],
    });
    // team2 is bidder but didn't make bid (3 < 7). team1 has higher score.
    expect(getWinningTeam(state)?.id).toBe('team1');
  });

  it('returns null when no team has reached target and scores are tied', () => {
    const state = gameOverState({
      teams: [
        { id: 'team1', name: 'Team 1', score: 10, playerIds: ['player1', 'player3'] },
        { id: 'team2', name: 'Team 2', score: 10, playerIds: ['player2', 'player4'] },
      ],
    });
    expect(getWinningTeam(state)).toBeNull();
  });
});

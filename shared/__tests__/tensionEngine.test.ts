import { describe, it, expect } from 'vitest';
import { computeTension, estimateRunningPoints } from '../tensionEngine';
import type { GameState, Player, Team, Card, Suit } from '../gameTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function card(rank: string, suit: Suit): Card {
  return { rank: rank as Card['rank'], suit, id: `${rank}-${suit}` };
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

function makeTeams(score1 = 0, score2 = 0): Team[] {
  return [
    { id: 'team1', name: 'Team 1', score: score1, playerIds: ['player1', 'player3'] },
    { id: 'team2', name: 'Team 2', score: score2, playerIds: ['player2', 'player4'] },
  ];
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'playing',
    players: [
      makePlayer({ id: 'player1', teamId: 'team1' }),
      makePlayer({ id: 'player2', teamId: 'team2' }),
      makePlayer({ id: 'player3', teamId: 'team1' }),
      makePlayer({ id: 'player4', teamId: 'team2' }),
    ],
    teams: makeTeams(),
    currentPlayerIndex: 0,
    dealerIndex: 3,
    trumpSuit: 'Hearts',
    highBid: 5,
    bidderId: 'player1',
    currentTrick: [],
    trickNumber: 1,
    leadPlayerIndex: 0,
    roundScores: {},
    deckColor: 'red',
    stock: [],
    discardPile: [],
    targetScore: 25,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Phase guard
// ---------------------------------------------------------------------------

describe('computeTension - phase guard', () => {
  it('returns 0 for setup phase', () => {
    const gs = makeGameState({ phase: 'setup' });
    expect(computeTension(gs)).toBe(0);
  });

  it('returns 0 for dealer-draw phase', () => {
    const gs = makeGameState({ phase: 'dealer-draw' });
    expect(computeTension(gs)).toBe(0);
  });

  it('returns 0 for dealing phase', () => {
    const gs = makeGameState({ phase: 'dealing' });
    expect(computeTension(gs)).toBe(0);
  });

  it('returns non-zero for bidding phase with game progress', () => {
    const gs = makeGameState({
      phase: 'bidding',
      teams: makeTeams(10, 12),
      highBid: 7,
    });
    expect(computeTension(gs)).toBeGreaterThan(0);
  });

  it('returns non-zero for playing phase', () => {
    const gs = makeGameState({
      phase: 'playing',
      teams: makeTeams(10, 10),
      highBid: 6,
      trickNumber: 3,
    });
    expect(computeTension(gs)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Target calibration
// ---------------------------------------------------------------------------

describe('computeTension - calibration', () => {
  it('returns ~0.09 for low-tension scenario (3-0, trick 1, bid 5)', () => {
    const gs = makeGameState({
      phase: 'playing',
      teams: makeTeams(3, 0),
      highBid: 5,
      trickNumber: 1,
      trumpSuit: 'Hearts',
    });
    const t = computeTension(gs);
    expect(t).toBeGreaterThanOrEqual(0.03);
    expect(t).toBeLessThanOrEqual(0.18);
  });

  it('returns ~0.92 for high-tension scenario (23-22, trick 6, bid 8)', () => {
    const gs = makeGameState({
      phase: 'playing',
      teams: makeTeams(23, 22),
      highBid: 8,
      trickNumber: 6,
      trumpSuit: 'Hearts',
      bidderId: 'player1',
    });
    const t = computeTension(gs);
    expect(t).toBeGreaterThanOrEqual(0.80);
    expect(t).toBeLessThanOrEqual(1.0);
  });
});

// ---------------------------------------------------------------------------
// Match point signal
// ---------------------------------------------------------------------------

describe('computeTension - match point', () => {
  it('produces high tension when both teams near target', () => {
    const gs = makeGameState({
      phase: 'playing',
      teams: makeTeams(20, 21),
      highBid: 7,
      trickNumber: 4,
    });
    const t = computeTension(gs);
    expect(t).toBeGreaterThan(0.5);
  });

  it('produces lower tension when only one team is near target', () => {
    const both = makeGameState({
      phase: 'playing',
      teams: makeTeams(20, 20),
      highBid: 6,
      trickNumber: 3,
    });
    const one = makeGameState({
      phase: 'playing',
      teams: makeTeams(20, 5),
      highBid: 6,
      trickNumber: 3,
    });
    expect(computeTension(both)).toBeGreaterThan(computeTension(one));
  });
});

// ---------------------------------------------------------------------------
// Bid height scaling
// ---------------------------------------------------------------------------

describe('computeTension - bid height', () => {
  it('bid 9 produces higher tension than bid 5, all else equal', () => {
    const base = {
      phase: 'playing' as const,
      teams: makeTeams(15, 14),
      trickNumber: 3,
    };
    const low = computeTension(makeGameState({ ...base, highBid: 5 }));
    const high = computeTension(makeGameState({ ...base, highBid: 9 }));
    expect(high).toBeGreaterThan(low);
  });
});

// ---------------------------------------------------------------------------
// Bid in danger
// ---------------------------------------------------------------------------

describe('computeTension - bid in danger', () => {
  it('increases tension when bidder is behind at late tricks', () => {
    // Bidder (player1, team1) has won no trump points by trick 5
    const safe = makeGameState({
      phase: 'playing',
      teams: makeTeams(15, 14),
      highBid: 7,
      trickNumber: 2,
      bidderId: 'player1',
    });
    const danger = makeGameState({
      phase: 'playing',
      teams: makeTeams(15, 14),
      highBid: 7,
      trickNumber: 5,
      bidderId: 'player1',
      // player1 has no tricksWon — falling behind
    });
    expect(computeTension(danger)).toBeGreaterThan(computeTension(safe));
  });
});

// ---------------------------------------------------------------------------
// estimateRunningPoints
// ---------------------------------------------------------------------------

describe('estimateRunningPoints', () => {
  it('counts High when bidder team has highest trump', () => {
    const players = [
      makePlayer({ id: 'p1', teamId: 'team1', tricksWon: [card('A', 'Hearts')] }),
      makePlayer({ id: 'p2', teamId: 'team2', tricksWon: [card('K', 'Hearts')] }),
      makePlayer({ id: 'p3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'p4', teamId: 'team2', tricksWon: [] }),
    ];
    const pts = estimateRunningPoints(players, 'team1', 'Hearts');
    // Has High (Ace) and not Low (2 is not present; lowest is K which is team2's)
    // Actually Ace is highest, K is team2's — team1 has High
    expect(pts).toBeGreaterThanOrEqual(1);
  });

  it('counts Five as 5 points', () => {
    const players = [
      makePlayer({ id: 'p1', teamId: 'team1', tricksWon: [card('5', 'Hearts')] }),
      makePlayer({ id: 'p2', teamId: 'team2', tricksWon: [] }),
      makePlayer({ id: 'p3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'p4', teamId: 'team2', tricksWon: [] }),
    ];
    const pts = estimateRunningPoints(players, 'team1', 'Hearts');
    // Has Low (5 is lowest trump seen), High (5 is also highest), Jack=no, Five=yes
    // So: High(1) + Low(1) + Five(5) = 7
    expect(pts).toBe(7);
  });

  it('counts Jack as 1 point', () => {
    const players = [
      makePlayer({ id: 'p1', teamId: 'team1', tricksWon: [card('J', 'Hearts'), card('A', 'Hearts')] }),
      makePlayer({ id: 'p2', teamId: 'team2', tricksWon: [card('2', 'Hearts')] }),
      makePlayer({ id: 'p3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'p4', teamId: 'team2', tricksWon: [] }),
    ];
    const pts = estimateRunningPoints(players, 'team1', 'Hearts');
    // High (Ace=team1), Low (2=team2, not team1), Jack(1)
    expect(pts).toBe(2); // High + Jack
  });

  it('returns 0 when no trump cards captured', () => {
    const players = [
      makePlayer({ id: 'p1', teamId: 'team1', tricksWon: [card('K', 'Spades')] }),
      makePlayer({ id: 'p2', teamId: 'team2', tricksWon: [] }),
      makePlayer({ id: 'p3', teamId: 'team1', tricksWon: [] }),
      makePlayer({ id: 'p4', teamId: 'team2', tricksWon: [] }),
    ];
    expect(estimateRunningPoints(players, 'team1', 'Hearts')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

describe('computeTension - bounds', () => {
  it('always returns value in [0, 1]', () => {
    const scenarios: Partial<GameState>[] = [
      { phase: 'setup' },
      { phase: 'playing', teams: makeTeams(0, 0), highBid: 5, trickNumber: 1 },
      { phase: 'playing', teams: makeTeams(24, 24), highBid: 9, trickNumber: 6 },
      { phase: 'scoring', teams: makeTeams(25, 20), highBid: 9, trickNumber: 7 },
      { phase: 'game-over', teams: makeTeams(30, 22), highBid: 8 },
      { phase: 'bidding', teams: makeTeams(0, 0), highBid: 0 },
    ];

    for (const overrides of scenarios) {
      const t = computeTension(makeGameState(overrides));
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });
});

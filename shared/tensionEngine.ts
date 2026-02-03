import type { GameState, Player, Suit, Card } from './gameTypes';
import { MIN_BID, MAX_BID, TOTAL_TRICKS } from './gameTypes';

// ---------------------------------------------------------------------------
// Signal weights (must sum to 1.0)
// ---------------------------------------------------------------------------
const W_SCORE_CLOSENESS = 0.28;
const W_MATCH_POINT = 0.28;
const W_BID_HEIGHT = 0.17;
const W_TRICK_PROGRESS = 0.12;
const W_BID_IN_DANGER = 0.10;
const W_DESPERATION = 0.05;

// Phases where tension is active
const ACTIVE_PHASES = new Set([
  'bidding',
  'trump-selection',
  'purge-draw',
  'discard-trump',
  'playing',
  'scoring',
  'game-over',
]);

// Power curve exponent — stretches mid-high values upward
const POWER_CURVE = 0.6;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Compute a tension value from 0.0 to 1.0 based on the current game state.
 * Returns 0 for non-gameplay phases (setup, dealer-draw, dealing).
 */
export function computeTension(gs: GameState): number {
  if (!ACTIVE_PHASES.has(gs.phase)) return 0;

  const target = gs.targetScore;
  const team1Score = gs.teams[0]?.score ?? 0;
  const team2Score = gs.teams[1]?.score ?? 0;

  // --- Signal 1: Score closeness (weighted by depth into game) ---
  const maxScore = Math.max(team1Score, team2Score, 1);
  const scoreDiff = Math.abs(team1Score - team2Score);
  const closeness = 1 - Math.min(scoreDiff / target, 1);
  const depth = Math.min(maxScore / target, 1);
  const scoreCloseness = closeness * depth;

  // --- Signal 2: Match point ---
  const team1CanWin = team1Score >= target - 9; // max possible round score = 9
  const team2CanWin = team2Score >= target - 9;
  let matchPoint = 0;
  if (team1CanWin && team2CanWin) matchPoint = 1.0;
  else if (team1CanWin || team2CanWin) matchPoint = 0.6;

  // --- Signal 3: Bid height (5 -> 0, 9 -> 1) ---
  const bidRange = MAX_BID - MIN_BID; // 4
  const bidHeight = gs.highBid > 0
    ? Math.min((gs.highBid - MIN_BID) / bidRange, 1)
    : 0;

  // --- Signal 4: Trick progress (trick 1 -> 0, trick 6 -> 1) ---
  const trickProgress = gs.trickNumber > 0
    ? Math.min((gs.trickNumber - 1) / (TOTAL_TRICKS - 1), 1)
    : 0;

  // --- Signal 5: Bid in danger ---
  const bidInDanger = computeBidInDanger(gs);

  // --- Signal 6: Desperation ---
  const desperation = computeDesperation(gs, team1Score, team2Score, target);

  // --- Weighted sum ---
  const raw =
    W_SCORE_CLOSENESS * scoreCloseness +
    W_MATCH_POINT * matchPoint +
    W_BID_HEIGHT * bidHeight +
    W_TRICK_PROGRESS * trickProgress +
    W_BID_IN_DANGER * bidInDanger +
    W_DESPERATION * desperation;

  // Power curve + clamp
  return clamp(Math.pow(raw, POWER_CURVE), 0, 1);
}

// ---------------------------------------------------------------------------
// Bid-in-danger: is the bidder falling behind mid-round?
// ---------------------------------------------------------------------------

function computeBidInDanger(gs: GameState): number {
  if (!gs.bidderId || gs.highBid <= 0 || !gs.trumpSuit) return 0;
  // Only relevant during playing phase
  if (gs.phase !== 'playing' && gs.phase !== 'scoring' && gs.phase !== 'game-over') return 0;

  const bidder = gs.players.find(p => p.id === gs.bidderId);
  if (!bidder) return 0;

  const bidderTeamId = bidder.teamId;
  const estimatedPoints = estimateRunningPoints(gs.players, bidderTeamId, gs.trumpSuit);

  // How far into the round are we? (0 at trick 1, 1 at trick 6)
  const progress = Math.min((gs.trickNumber - 1) / (TOTAL_TRICKS - 1), 1);

  // Expected points at this stage if on track
  const expectedAtThisPoint = gs.highBid * progress;

  // Danger = how far behind expected pace, scaled by progress
  // (early tricks: low danger even if behind; late tricks: high danger)
  if (estimatedPoints >= expectedAtThisPoint) return 0;

  const deficit = (expectedAtThisPoint - estimatedPoints) / gs.highBid;
  return clamp(deficit * progress, 0, 1);
}

// ---------------------------------------------------------------------------
// Desperation: trailing team bidding high to catch up
// ---------------------------------------------------------------------------

function computeDesperation(
  gs: GameState,
  team1Score: number,
  team2Score: number,
  target: number,
): number {
  if (!gs.bidderId || gs.highBid <= 0) return 0;

  const bidder = gs.players.find(p => p.id === gs.bidderId);
  if (!bidder) return 0;

  const bidderTeamScore = bidder.teamId === 'team1' ? team1Score : team2Score;
  const otherTeamScore = bidder.teamId === 'team1' ? team2Score : team1Score;

  // Only desperate if bidder's team is behind
  if (bidderTeamScore >= otherTeamScore) return 0;

  const trailingGap = (otherTeamScore - bidderTeamScore) / target;
  const bidAggression = (gs.highBid - MIN_BID) / (MAX_BID - MIN_BID);

  return clamp(trailingGap * bidAggression, 0, 1);
}

// ---------------------------------------------------------------------------
// Estimate running points from tricksWon mid-round
// ---------------------------------------------------------------------------

/**
 * Scan each player's tricksWon for trump point-bearers (Ace=High, 2=Low, Jack, Five).
 * Game point can't be reliably estimated mid-round, so it's excluded.
 * Returns estimated points earned so far by the bidder's team.
 */
export function estimateRunningPoints(
  players: Player[],
  bidderTeamId: string,
  trumpSuit: Suit,
): number {
  let points = 0;

  // Collect all trump cards won by each team
  const teamTrumps: Record<string, Card[]> = {};
  for (const p of players) {
    if (!teamTrumps[p.teamId]) teamTrumps[p.teamId] = [];
    for (const c of p.tricksWon) {
      if (c.suit === trumpSuit) {
        teamTrumps[p.teamId].push(c);
      }
    }
  }

  const bidderTrumps = teamTrumps[bidderTeamId] ?? [];
  const allTrumps = Object.values(teamTrumps).flat();

  // High: does bidder team have the highest trump seen so far?
  if (allTrumps.length > 0) {
    const highCard = allTrumps.reduce((best, c) =>
      rankValue(c.rank) > rankValue(best.rank) ? c : best
    );
    if (bidderTrumps.some(c => c.id === highCard.id)) points += 1;

    // Low: does bidder team have the lowest trump seen so far?
    const lowCard = allTrumps.reduce((best, c) =>
      rankValue(c.rank) < rankValue(best.rank) ? c : best
    );
    if (bidderTrumps.some(c => c.id === lowCard.id)) points += 1;
  }

  // Jack: did bidder team capture the Jack of trump?
  if (bidderTrumps.some(c => c.rank === 'J')) points += 1;

  // Five: did bidder team capture the Five of trump? (worth 5)
  if (bidderTrumps.some(c => c.rank === '5')) points += 5;

  return points;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function rankValue(rank: string): number {
  const order: Record<string, number> = {
    '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6,
    '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
  };
  return order[rank] ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

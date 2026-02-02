import type { GameRoom } from './types';
import { storage } from '../storage';
import { log } from '../index';

export async function trackPlayerStats(room: GameRoom, previousPhase: string) {
  if (!room.gameState) return;

  const state = room.gameState;
  const newPhase = state.phase;
  const gameInstance = room.gameInstanceId || 0;

  const roundSignature = state.teams.map(t => t.score).join('-');

  const isScoring = newPhase === 'scoring';
  const isGameOver = newPhase === 'game-over';

  const isScoringAlreadyProcessed = isScoring &&
    room.lastProcessedRoundSignature === roundSignature &&
    room.lastProcessedGame === gameInstance;

  const isGameOverAlreadyProcessed = isGameOver &&
    room.lastProcessedGameOver === gameInstance;

  if (isScoringAlreadyProcessed) {
    log(`Skipping duplicate scoring stats update for round signature ${roundSignature}, game ${gameInstance}`, 'stats');
    return;
  }
  if (isGameOverAlreadyProcessed) {
    log(`Skipping duplicate game-over stats update for game ${gameInstance}`, 'stats');
    return;
  }

  if ((previousPhase !== 'scoring' && previousPhase !== 'game-over') &&
      (newPhase === 'scoring' || newPhase === 'game-over')) {

    if (isScoring) {
      room.lastProcessedRoundSignature = roundSignature;
      room.lastProcessedGame = gameInstance;
    }
    if (isGameOver) {
      room.lastProcessedGameOver = gameInstance;
    }

    const bidder = state.players.find(p => p.id === state.bidderId);
    const bidderTeam = state.teams.find(t => bidder && state.players.find(pl => pl.id === bidder.id)?.teamId === t.id);

    const bidderTeamScore = bidderTeam ? state.roundScores[bidderTeam.id] || 0 : 0;
    const bidMade = bidderTeamScore >= state.highBid;

    for (const player of Array.from(room.players.values())) {
      try {
        const gamePlayer = state.players[player.seatIndex];
        if (!gamePlayer || !gamePlayer.isHuman) continue;

        const playerTeam = state.teams.find(t => t.id === gamePlayer.teamId);
        const teamRoundScore = playerTeam ? state.roundScores[playerTeam.id] || 0 : 0;

        const isBidder = gamePlayer.id === state.bidderId;

        const increments: Record<string, number> = {
          totalPointsScored: teamRoundScore,
        };

        if (isBidder) {
          increments.bidsMade = 1;
          if (bidMade) {
            increments.bidsSucceeded = 1;
            if (state.highBid > 0) {
              increments.highestBidMade = state.highBid;
            }
          } else {
            increments.timesSet = 1;
          }
          if (state.highBid > 0) {
            increments.highestBid = state.highBid;
          }
        }

        const allHuman = state.players.every(p => p.isHuman);
        if (newPhase === 'game-over' && playerTeam && allHuman) {
          increments.gamesPlayed = 1;
          if (playerTeam.score >= state.targetScore) {
            increments.gamesWon = 1;
          }
        }

        if (Object.keys(increments).length > 0) {
          const statsUserId = player.userId || player.playerToken;
          await storage.incrementUserStats(statsUserId, increments);
          log(`Updated stats for player ${player.playerName} (userId: ${statsUserId})`, 'stats');
        }
      } catch (err) {
        log(`Error updating stats for ${player.playerName}: ${err}`, 'stats');
      }
    }
  }
}

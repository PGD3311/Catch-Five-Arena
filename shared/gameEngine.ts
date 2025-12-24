import {
  Card,
  Player,
  Team,
  GameState,
  Suit,
  DeckColor,
  DealerDrawCard,
  createDeck,
  shuffleDeck,
  determineTrickWinner,
  calculateRoundScores,
  RANK_ORDER,
  RANK_ORDER_ACE_LOW,
  MIN_BID,
  MAX_BID,
  INITIAL_HAND_SIZE,
  FINAL_HAND_SIZE,
  TOTAL_TRICKS,
  DEFAULT_TARGET_SCORE,
} from './gameTypes';

export function initializeGame(deckColor: DeckColor = 'blue', targetScore: number = DEFAULT_TARGET_SCORE): GameState {
  const players: Player[] = [
    { id: 'player1', name: 'You', isHuman: true, hand: [], teamId: 'team1', bid: null, tricksWon: [] },
    { id: 'player2', name: 'CPU 1', isHuman: false, hand: [], teamId: 'team2', bid: null, tricksWon: [] },
    { id: 'player3', name: 'Partner', isHuman: false, hand: [], teamId: 'team1', bid: null, tricksWon: [] },
    { id: 'player4', name: 'CPU 2', isHuman: false, hand: [], teamId: 'team2', bid: null, tricksWon: [] },
  ];

  const teams: Team[] = [
    { id: 'team1', name: 'Your Team', score: 0, playerIds: ['player1', 'player3'] },
    { id: 'team2', name: 'Opponents', score: 0, playerIds: ['player2', 'player4'] },
  ];

  return {
    phase: 'setup',
    players,
    teams,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    trumpSuit: null,
    highBid: 0,
    bidderId: null,
    currentTrick: [],
    trickNumber: 1,
    leadPlayerIndex: 0,
    roundScores: {},
    deckColor,
    stock: [],
    discardPile: [],
    targetScore,
    dealerDrawCards: [],
  };
}

export function startDealerDraw(state: GameState): GameState {
  const deck = shuffleDeck(createDeck());
  const dealerDrawCards: DealerDrawCard[] = state.players.map((player, index) => ({
    playerId: player.id,
    card: deck[index],
  }));

  return {
    ...state,
    phase: 'dealer-draw',
    dealerDrawCards,
  };
}

export function finalizeDealerDraw(state: GameState): GameState {
  if (!state.dealerDrawCards || state.dealerDrawCards.length === 0) {
    return { ...state, phase: 'setup', dealerIndex: 0 };
  }

  const getDealerDrawValue = (card: Card): number => {
    if (card.rank === 'A' && card.suit === 'Spades') return -1;
    return RANK_ORDER_ACE_LOW[card.rank];
  };

  let lowestIndex = 0;
  let lowestValue = getDealerDrawValue(state.dealerDrawCards[0].card);

  for (let i = 1; i < state.dealerDrawCards.length; i++) {
    const cardValue = getDealerDrawValue(state.dealerDrawCards[i].card);
    if (cardValue < lowestValue) {
      lowestValue = cardValue;
      lowestIndex = i;
    }
  }

  return {
    ...state,
    dealerIndex: lowestIndex,
    dealerDrawCards: state.dealerDrawCards,
  };
}

export function dealCards(state: GameState): GameState {
  const deck = shuffleDeck(createDeck());
  const newPlayers = state.players.map((player, index) => ({
    ...player,
    hand: deck.slice(index * INITIAL_HAND_SIZE, (index + 1) * INITIAL_HAND_SIZE),
    bid: null,
    tricksWon: [],
  }));

  const stock = deck.slice(4 * INITIAL_HAND_SIZE);
  const firstBidderIndex = (state.dealerIndex + 1) % 4;

  return {
    ...state,
    phase: 'bidding',
    players: newPlayers,
    currentPlayerIndex: firstBidderIndex,
    trumpSuit: null,
    highBid: 0,
    bidderId: null,
    currentTrick: [],
    trickNumber: 1,
    roundScores: {},
    stock,
    discardPile: [],
  };
}

export function getCpuBid(hand: Card[], highBid: number, isDealer: boolean, allPassed: boolean): number {
  if (isDealer && allPassed) {
    return MIN_BID;
  }

  let trumpPotential = 0;
  const suitCounts: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
  const suitStrength: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };

  for (const card of hand) {
    suitCounts[card.suit]++;
    if (card.rank === '5') {
      suitStrength[card.suit] += 5;
    } else if (card.rank === 'A') {
      suitStrength[card.suit] += 3;
    } else if (card.rank === 'J') {
      suitStrength[card.suit] += 2;
    } else if (card.rank === 'K' || card.rank === 'Q') {
      suitStrength[card.suit] += 1;
    }
  }

  let bestSuit: Suit = 'Hearts';
  let bestScore = 0;
  for (const suit of Object.keys(suitCounts) as Suit[]) {
    const score = suitCounts[suit] * 2 + suitStrength[suit];
    if (score > bestScore) {
      bestScore = score;
      bestSuit = suit;
    }
  }

  trumpPotential = Math.min(MAX_BID, Math.max(MIN_BID, Math.floor(bestScore / 2)));

  if (trumpPotential > highBid && Math.random() > 0.3) {
    return trumpPotential;
  }
  return 0;
}

export function getCpuTrumpChoice(hand: Card[], forcedBid: boolean = false): Suit {
  const suits: Suit[] = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
  const suitScores: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };
  const suitCounts: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };

  for (const card of hand) {
    suitCounts[card.suit] += 1;
    suitScores[card.suit] += 1;
    if (card.rank === '5') suitScores[card.suit] += 6;
    if (card.rank === 'J') suitScores[card.suit] += 2;
    if (card.rank === 'A') suitScores[card.suit] += 4;
    if (card.rank === 'K') suitScores[card.suit] += 2;
    if (card.rank === 'Q') suitScores[card.suit] += 1;
  }

  // "Desperate Dig" Strategy: If forced to bid with a terrible hand,
  // call a suit you have NONE of - discard everything and draw fresh
  if (forcedBid) {
    const bestScore = Math.max(...Object.values(suitScores));
    if (bestScore <= 2) {
      const emptySuits = suits.filter(s => suitCounts[s] === 0);
      if (emptySuits.length > 0) {
        return emptySuits[Math.floor(Math.random() * emptySuits.length)];
      }
    }
  }

  return Object.entries(suitScores).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as Suit;
}

export function getCpuCardToPlay(
  hand: Card[],
  currentTrick: { playerId: string; card: Card }[],
  trumpSuit: Suit | null,
  cpuPlayerId?: string,
  allPlayers?: { id: string }[],
  bidderId?: string | null
): Card {
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  const isBidWinner = cpuPlayerId && bidderId && cpuPlayerId === bidderId;
  
  if (currentTrick.length === 0) {
    if (trumpCards.length > 0) {
      // Never lead the 5 or 2
      const safeLeadTrumps = trumpCards.filter(c => c.rank !== '5' && c.rank !== '2');
      
      // Bid winner leads high trumps to hunt
      if (isBidWinner) {
        const ace = trumpCards.find(c => c.rank === 'A');
        if (ace) return ace;
        const king = trumpCards.find(c => c.rank === 'K');
        if (king && trumpCards.length >= 2) return king;
      }
      
      if (safeLeadTrumps.length > 0) {
        return isBidWinner
          ? safeLeadTrumps.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a))
          : safeLeadTrumps.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
      
      return trumpCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
    }
    return hand.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
  }

  const leadSuit = currentTrick[0].card.suit;
  const followCards = hand.filter(c => c.suit === leadSuit);

  if (followCards.length > 0) {
    return followCards.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
  }

  if (trumpCards.length > 0) {
    return trumpCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
  }

  return hand.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
}

export function processBid(state: GameState, bid: number): GameState {
  const newPlayers = [...state.players];
  newPlayers[state.currentPlayerIndex] = {
    ...newPlayers[state.currentPlayerIndex],
    bid,
  };

  let newHighBid = state.highBid;
  let newBidderId = state.bidderId;

  if (bid > state.highBid) {
    newHighBid = bid;
    newBidderId = newPlayers[state.currentPlayerIndex].id;
  }

  const nextPlayerIndex = (state.currentPlayerIndex + 1) % 4;
  const allBid = newPlayers.every(p => p.bid !== null);

  if (allBid) {
    if (newHighBid === 0) {
      const dealerPlayer = newPlayers[state.dealerIndex];
      newHighBid = MIN_BID;
      newBidderId = dealerPlayer.id;
      newPlayers[state.dealerIndex] = { ...dealerPlayer, bid: MIN_BID };
    }

    const bidderIndex = newPlayers.findIndex(p => p.id === newBidderId);

    return {
      ...state,
      players: newPlayers,
      highBid: newHighBid,
      bidderId: newBidderId,
      phase: 'trump-selection',
      currentPlayerIndex: bidderIndex,
    };
  }

  return {
    ...state,
    players: newPlayers,
    highBid: newHighBid,
    bidderId: newBidderId,
    currentPlayerIndex: nextPlayerIndex,
  };
}

export function selectTrump(state: GameState, suit: Suit): GameState {
  return {
    ...state,
    trumpSuit: suit,
    phase: 'purge-draw' as const,
  };
}

export function performPurgeAndDraw(state: GameState): GameState {
  const trumpSuit = state.trumpSuit!;
  let stock = [...state.stock];
  let discardPile = [...state.discardPile];
  const bidderIndex = state.players.findIndex(p => p.id === state.bidderId);

  const newPlayers = state.players.map((player) => {
    const trumpCards = player.hand.filter(c => c.suit === trumpSuit);
    const nonTrumpCards = player.hand.filter(c => c.suit !== trumpSuit);

    discardPile = [...discardPile, ...nonTrumpCards];

    let keptCards: Card[];
    if (trumpCards.length >= INITIAL_HAND_SIZE) {
      keptCards = trumpCards
        .sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank])
        .slice(0, FINAL_HAND_SIZE);
      discardPile = [...discardPile, ...trumpCards.slice(FINAL_HAND_SIZE)];
    } else {
      keptCards = trumpCards;
    }

    return { ...player, hand: keptCards };
  });

  const drawOrder = [
    bidderIndex,
    (bidderIndex + 1) % 4,
    (bidderIndex + 2) % 4,
    (bidderIndex + 3) % 4,
  ];

  for (const playerIndex of drawOrder) {
    const player = newPlayers[playerIndex];
    const cardsToDraw = FINAL_HAND_SIZE - player.hand.length;

    for (let i = 0; i < cardsToDraw; i++) {
      if (stock.length === 0 && discardPile.length > 0) {
        stock = shuffleDeck(discardPile);
        discardPile = [];
      }
      if (stock.length > 0) {
        player.hand.push(stock.pop()!);
      }
    }
  }

  return {
    ...state,
    players: newPlayers,
    stock,
    discardPile,
    phase: 'playing',
    currentPlayerIndex: bidderIndex,
    leadPlayerIndex: bidderIndex,
  };
}

export function playCard(state: GameState, card: Card): GameState {
  const player = state.players[state.currentPlayerIndex];
  const newHand = player.hand.filter(c => c.id !== card.id);
  const newPlayers = [...state.players];
  newPlayers[state.currentPlayerIndex] = { ...player, hand: newHand };

  const newTrick = [...state.currentTrick, { playerId: player.id, card }];

  if (newTrick.length === 4) {
    const winnerId = determineTrickWinner(newTrick, state.trumpSuit);
    const winnerIndex = newPlayers.findIndex(p => p.id === winnerId);
    const trickCards = newTrick.map(t => t.card);

    newPlayers[winnerIndex] = {
      ...newPlayers[winnerIndex],
      tricksWon: [...newPlayers[winnerIndex].tricksWon, ...trickCards],
    };

    const newTrickNumber = state.trickNumber + 1;

    const scoreDetails = calculateRoundScores(newPlayers, state.teams, state.trumpSuit!);
    const bidderTeamId = newPlayers.find(p => p.id === state.bidderId)?.teamId;
    
    // Check for early game-over conditions:
    // 1. Non-bidding team can win mid-round if they reach target (can't be set)
    // 2. Bidding team can win mid-round if they reach target AND have made their bid
    const nonBidderTeam = state.teams.find(t => t.id !== bidderTeamId);
    const bidderTeam = state.teams.find(t => t.id === bidderTeamId);
    const nonBidderPoints = scoreDetails.teamPoints[nonBidderTeam?.id || ''] || 0;
    const bidderPoints = scoreDetails.teamPoints[bidderTeamId || ''] || 0;
    const nonBidderCurrentScore = (nonBidderTeam?.score || 0) + nonBidderPoints;
    const bidderCurrentScore = (bidderTeam?.score || 0) + bidderPoints;
    const bidderMadeBid = bidderPoints >= state.highBid;
    
    // Early game-over if non-bidder hits 25+, or bidder hits 25+ AND made their bid
    const earlyGameOver = nonBidderCurrentScore >= state.targetScore || 
      (bidderCurrentScore >= state.targetScore && bidderMadeBid);
    
    if (newTrickNumber > TOTAL_TRICKS || earlyGameOver) {
      const newTeams = state.teams.map(team => {
        let pointsToAdd = scoreDetails.teamPoints[team.id];
        
        // Only apply set penalty at end of round, not for early game-over
        if (!earlyGameOver && team.id === bidderTeamId && pointsToAdd < state.highBid) {
          pointsToAdd = -state.highBid;
        }
        
        return {
          ...team,
          score: team.score + pointsToAdd,
        };
      });

      // Game ends when any team reaches target score
      const gameOver = newTeams.some(t => t.score >= state.targetScore);

      return {
        ...state,
        players: newPlayers,
        teams: newTeams,
        currentTrick: [],
        lastTrick: newTrick,
        lastTrickWinnerId: winnerId,
        trickNumber: newTrickNumber,
        phase: gameOver ? 'game-over' : 'scoring',
        roundScores: scoreDetails.teamPoints,
        roundScoreDetails: scoreDetails,
      };
    }

    return {
      ...state,
      players: newPlayers,
      currentTrick: [],
      lastTrick: newTrick,
      lastTrickWinnerId: winnerId,
      trickNumber: newTrickNumber,
      currentPlayerIndex: winnerIndex,
      leadPlayerIndex: winnerIndex,
    };
  }

  return {
    ...state,
    players: newPlayers,
    currentTrick: newTrick,
    currentPlayerIndex: (state.currentPlayerIndex + 1) % 4,
  };
}

export function canPlayCard(card: Card, hand: Card[], currentTrick: { playerId: string; card: Card }[]): boolean {
  if (currentTrick.length === 0) return true;

  const leadSuit = currentTrick[0].card.suit;
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);

  if (hasLeadSuit) {
    return card.suit === leadSuit;
  }

  return true;
}

export function startNewRound(state: GameState): GameState {
  const newDealerIndex = (state.dealerIndex + 1) % 4;
  return dealCards({
    ...state,
    dealerIndex: newDealerIndex,
    players: state.players.map(p => ({ ...p, tricksWon: [], bid: null })),
  });
}

export function checkGameOver(state: GameState): boolean {
  return state.teams.some(t => t.score >= state.targetScore);
}

export function getWinningTeam(state: GameState): Team | null {
  const teamsAt25 = state.teams.filter(t => t.score >= state.targetScore);
  
  if (teamsAt25.length === 0) {
    // No team at target - check for max score (shouldn't happen in game-over)
    const maxScore = Math.max(...state.teams.map(t => t.score));
    const winners = state.teams.filter(t => t.score === maxScore);
    return winners.length === 1 ? winners[0] : null;
  }
  
  if (teamsAt25.length === 1) {
    return teamsAt25[0];
  }
  
  // Both teams at 25+ - bidder wins if they made their bid, otherwise highest score
  const bidderTeamId = state.players.find(p => p.id === state.bidderId)?.teamId;
  const bidderTeam = teamsAt25.find(t => t.id === bidderTeamId);
  const nonBidderTeam = teamsAt25.find(t => t.id !== bidderTeamId);
  
  // If bidder made their bid (they're at 25+ without being set), they win
  if (bidderTeam && state.roundScores) {
    const bidderPoints = state.roundScores[bidderTeamId!] || 0;
    if (bidderPoints >= state.highBid) {
      return bidderTeam;
    }
  }
  
  // Otherwise highest score wins, or non-bidder if tied
  if (bidderTeam && nonBidderTeam) {
    if (bidderTeam.score > nonBidderTeam.score) return bidderTeam;
    return nonBidderTeam;
  }
  
  return teamsAt25[0];
}

export function isPlayersTurn(state: GameState, playerId: string): boolean {
  return state.players[state.currentPlayerIndex].id === playerId;
}

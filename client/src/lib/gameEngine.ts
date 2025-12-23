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
} from '@shared/gameTypes';

export { determineTrickWinner };

export function checkAutoClaim(players: Player[], trumpSuit: Suit | null): { claimerId: string; remainingTricks: number } | null {
  if (!trumpSuit) return null;
  
  const allRemainingTrumps: { playerId: string; rank: number }[] = [];
  
  for (const player of players) {
    for (const card of player.hand) {
      if (card.suit === trumpSuit) {
        allRemainingTrumps.push({ playerId: player.id, rank: RANK_ORDER[card.rank] });
      }
    }
  }
  
  if (allRemainingTrumps.length === 0) return null;
  
  allRemainingTrumps.sort((a, b) => b.rank - a.rank);
  
  const topPlayerId = allRemainingTrumps[0].playerId;
  const playerHasAllTop = allRemainingTrumps.every(t => t.playerId === topPlayerId) ||
    allRemainingTrumps.filter(t => t.playerId === topPlayerId)
      .every((t, idx) => t.rank === allRemainingTrumps[idx].rank);
  
  if (!playerHasAllTop) {
    const playerTrumps = allRemainingTrumps.filter(t => t.playerId === topPlayerId);
    const otherTrumps = allRemainingTrumps.filter(t => t.playerId !== topPlayerId);
    
    if (otherTrumps.length === 0) {
      const remainingTricks = players[0].hand.length;
      return { claimerId: topPlayerId, remainingTricks };
    }
    
    const highestOtherTrump = Math.max(...otherTrumps.map(t => t.rank));
    const allPlayerTrumpsHigher = playerTrumps.every(t => t.rank > highestOtherTrump);
    
    if (allPlayerTrumpsHigher && playerTrumps.length >= otherTrumps.length) {
      const remainingTricks = players[0].hand.length;
      return { claimerId: topPlayerId, remainingTricks };
    }
    
    return null;
  }
  
  const remainingTricks = players[0].hand.length;
  return { claimerId: topPlayerId, remainingTricks };
}

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

const SUIT_ORDER: Record<string, number> = {
  'Clubs': 0,
  'Diamonds': 1,
  'Hearts': 2,
  'Spades': 3,
};

export function finalizeDealerDraw(state: GameState): GameState {
  if (!state.dealerDrawCards || state.dealerDrawCards.length === 0) {
    return { ...state, phase: 'setup', dealerIndex: 0 };
  }

  const getDealerDrawValue = (card: Card): number => {
    const rankValue = RANK_ORDER_ACE_LOW[card.rank];
    const suitValue = SUIT_ORDER[card.suit];
    return rankValue * 10 + suitValue;
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

  let bestScore = 0;
  for (const suit of Object.keys(suitCounts) as Suit[]) {
    const score = suitCounts[suit] * 2 + suitStrength[suit];
    if (score > bestScore) {
      bestScore = score;
    }
  }

  const trumpPotential = Math.min(MAX_BID, Math.max(MIN_BID, Math.floor(bestScore / 2)));

  if (isDealer) {
    if (highBid === MAX_BID && trumpPotential >= highBid) {
      return MAX_BID;
    }
    if (trumpPotential > highBid) {
      return highBid + 1;
    }
    return 0;
  }

  if (trumpPotential > highBid && Math.random() > 0.3) {
    return trumpPotential;
  }
  return 0;
}

export function getCpuTrumpChoice(hand: Card[]): Suit {
  const suitScores: Record<Suit, number> = { Hearts: 0, Diamonds: 0, Clubs: 0, Spades: 0 };

  for (const card of hand) {
    suitScores[card.suit] += 1;
    if (card.rank === '5') suitScores[card.suit] += 6;
    if (card.rank === 'J') suitScores[card.suit] += 2;
    if (card.rank === 'A') suitScores[card.suit] += 4;
    if (card.rank === 'K') suitScores[card.suit] += 2;
    if (card.rank === 'Q') suitScores[card.suit] += 1;
  }

  return Object.entries(suitScores).reduce((a, b) => (b[1] > a[1] ? b : a))[0] as Suit;
}

export function getCpuCardToPlay(
  hand: Card[],
  currentTrick: { playerId: string; card: Card }[],
  trumpSuit: Suit | null,
  cpuPlayerId?: string,
  allPlayers?: { id: string }[]
): Card {
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  const POINT_RANKS = ['5', 'J', '2', 'A'];
  const hasPointCard = (rank: string) => hand.some(c => c.suit === trumpSuit && c.rank === rank);
  const hasFiveOfTrump = hasPointCard('5');
  const hasJackOfTrump = hasPointCard('J');
  const hasDeuceOfTrump = hasPointCard('2');
  const hasAceOfTrump = hasPointCard('A');
  
  const getPointCardInTrick = () => {
    const pointCards = currentTrick.filter(tc => 
      tc.card.suit === trumpSuit && POINT_RANKS.includes(tc.card.rank)
    );
    pointCards.sort((a, b) => {
      const priority: Record<string, number> = { '5': 0, 'J': 1, '2': 2, 'A': 3 };
      return priority[a.card.rank] - priority[b.card.rank];
    });
    return pointCards[0] || null;
  };
  
  const getTeammate = () => {
    if (!cpuPlayerId || !allPlayers) return null;
    const myIndex = allPlayers.findIndex(p => p.id === cpuPlayerId);
    if (myIndex === -1) return null;
    const teammateIndex = (myIndex + 2) % 4;
    return allPlayers[teammateIndex]?.id;
  };
  
  const getPlayersAfterMe = (): string[] => {
    if (!cpuPlayerId || !allPlayers) return [];
    const myIndex = allPlayers.findIndex(p => p.id === cpuPlayerId);
    if (myIndex === -1) return [];
    const playedIds = currentTrick.map(tc => tc.playerId);
    const result: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const idx = (myIndex + i) % 4;
      const pid = allPlayers[idx]?.id;
      if (pid && !playedIds.includes(pid)) {
        result.push(pid);
      }
    }
    return result;
  };
  
  const getCurrentWinner = (): { playerId: string; card: Card } | null => {
    if (currentTrick.length === 0) return null;
    const leadSuit = currentTrick[0].card.suit;
    let winner = currentTrick[0];
    
    for (const tc of currentTrick) {
      if (tc.card.suit === trumpSuit) {
        if (winner.card.suit !== trumpSuit || RANK_ORDER[tc.card.rank] > RANK_ORDER[winner.card.rank]) {
          winner = tc;
        }
      } else if (tc.card.suit === leadSuit && winner.card.suit !== trumpSuit) {
        if (RANK_ORDER[tc.card.rank] > RANK_ORDER[winner.card.rank]) {
          winner = tc;
        }
      }
    }
    return winner;
  };
  
  const getMyPointCards = () => trumpCards.filter(c => POINT_RANKS.includes(c.rank));
  const getNonPointTrumps = () => trumpCards.filter(c => !POINT_RANKS.includes(c.rank));

  if (currentTrick.length === 0) {
    if (trumpCards.length > 0) {
      if (hasAceOfTrump && !hasFiveOfTrump && trumpCards.length >= 2) {
        const aceCard = trumpCards.find(c => c.rank === 'A');
        if (aceCard) return aceCard;
      }
      if (hasFiveOfTrump && trumpCards.length >= 3) {
        const highTrumps = trumpCards.filter(c => c.rank !== '5' && RANK_ORDER[c.rank] >= RANK_ORDER['J']);
        if (highTrumps.length > 0) {
          return highTrumps.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
        }
      }
      const nonPointTrumps = getNonPointTrumps();
      if (nonPointTrumps.length > 0) {
        return nonPointTrumps.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
      }
      return trumpCards.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
    }
    return hand.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
  }

  const leadSuit = currentTrick[0].card.suit;
  const followCards = hand.filter(c => c.suit === leadSuit);
  const teammateId = getTeammate();
  const currentWinner = getCurrentWinner();
  const teammateIsWinning = currentWinner && currentWinner.playerId === teammateId;
  const playersAfterMe = getPlayersAfterMe();
  const opponentsAfterMe = playersAfterMe.filter(pid => pid !== teammateId);
  
  const pointCardInTrick = getPointCardInTrick();
  const teammateHasPointCard = pointCardInTrick && pointCardInTrick.playerId === teammateId;

  if (pointCardInTrick && !teammateHasPointCard) {
    const targetRank = RANK_ORDER[pointCardInTrick.card.rank];
    
    if (followCards.length > 0 && leadSuit === trumpSuit) {
      const winningCards = followCards.filter(c => RANK_ORDER[c.rank] > targetRank);
      if (winningCards.length > 0) {
        const nonPointWinners = winningCards.filter(c => !POINT_RANKS.includes(c.rank) || c.rank === 'A');
        if (nonPointWinners.length > 0) {
          return nonPointWinners.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
        return winningCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
    }
    
    if (followCards.length === 0 && trumpCards.length > 0) {
      const highestTrickTrump = currentTrick
        .filter(tc => tc.card.suit === trumpSuit)
        .reduce((max, tc) => Math.max(max, RANK_ORDER[tc.card.rank]), -1);
      
      const winningTrumps = trumpCards.filter(c => RANK_ORDER[c.rank] > highestTrickTrump);
      if (winningTrumps.length > 0) {
        const nonPointWinners = winningTrumps.filter(c => !POINT_RANKS.includes(c.rank) || c.rank === 'A');
        if (nonPointWinners.length > 0) {
          return nonPointWinners.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
        }
        if (hasAceOfTrump) {
          const aceCard = trumpCards.find(c => c.rank === 'A');
          if (aceCard) return aceCard;
        }
        return winningTrumps.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
    }
  }

  if (followCards.length > 0) {
    const myPointCards = getMyPointCards();
    const safeFollowCards = followCards.filter(c => !POINT_RANKS.includes(c.rank) || c.rank === 'A');
    
    if (leadSuit === trumpSuit && myPointCards.length > 0) {
      if (safeFollowCards.length > 0) {
        if (currentWinner && !teammateIsWinning) {
          const winningCards = safeFollowCards.filter(c => RANK_ORDER[c.rank] > RANK_ORDER[currentWinner.card.rank]);
          if (winningCards.length > 0) {
            return winningCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
          }
        }
        return safeFollowCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
      if (hasAceOfTrump) {
        const aceCard = followCards.find(c => c.rank === 'A');
        if (aceCard) return aceCard;
      }
    }
    
    return followCards.reduce((a, b) => (RANK_ORDER[b.rank] > RANK_ORDER[a.rank] ? b : a));
  }

  if (trumpCards.length > 0) {
    const shouldProtect = 
      !hasFiveOfTrump && 
      !pointCardInTrick && 
      leadSuit !== trumpSuit && 
      opponentsAfterMe.length > 0 && 
      !teammateIsWinning;
    
    if (shouldProtect) {
      const protectiveTrumps = trumpCards.filter(c => RANK_ORDER[c.rank] > RANK_ORDER['5'] && c.rank !== 'A');
      const highestTrickTrump = currentTrick
        .filter(tc => tc.card.suit === trumpSuit)
        .reduce((max, tc) => Math.max(max, RANK_ORDER[tc.card.rank]), -1);
      
      const winningProtectiveTrumps = protectiveTrumps.filter(c => RANK_ORDER[c.rank] > highestTrickTrump);
      
      if (winningProtectiveTrumps.length > 0) {
        return winningProtectiveTrumps.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
      }
      
      if (hasAceOfTrump && opponentsAfterMe.length > 0) {
        const aceCard = trumpCards.find(c => c.rank === 'A');
        if (aceCard) return aceCard;
      }
    }
    
    const nonPointTrumps = getNonPointTrumps();
    if (nonPointTrumps.length > 0) {
      return nonPointTrumps.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
    }
    
    if (hasAceOfTrump) {
      const aceCard = trumpCards.find(c => c.rank === 'A');
      if (aceCard) return aceCard;
    }
    
    return trumpCards.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
  }

  return hand.reduce((a, b) => (RANK_ORDER[a.rank] < RANK_ORDER[b.rank] ? a : b));
}

export function processBid(state: GameState, bid: number): GameState {
  const newPlayers = [...state.players];
  const isDealer = state.currentPlayerIndex === state.dealerIndex;
  newPlayers[state.currentPlayerIndex] = {
    ...newPlayers[state.currentPlayerIndex],
    bid,
  };

  let newHighBid = state.highBid;
  let newBidderId = state.bidderId;

  if (bid > state.highBid) {
    newHighBid = bid;
    newBidderId = newPlayers[state.currentPlayerIndex].id;
  } else if (isDealer && bid === MAX_BID && state.highBid === MAX_BID) {
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
  return performPurgeAndDraw({
    ...state,
    trumpSuit: suit,
  });
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

    if (newTrickNumber > TOTAL_TRICKS) {
      const scoreDetails = calculateRoundScores(newPlayers, state.teams, state.trumpSuit!);
      const bidderTeamId = newPlayers.find(p => p.id === state.bidderId)?.teamId;
      
      const newTeams = state.teams.map(team => {
        let pointsToAdd = scoreDetails.teamPoints[team.id];
        
        if (team.id === bidderTeamId && pointsToAdd < state.highBid) {
          pointsToAdd = -state.highBid;
        }
        
        return {
          ...team,
          score: team.score + pointsToAdd,
        };
      });

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

export function canPlayCard(card: Card, hand: Card[], currentTrick: { playerId: string; card: Card }[], trumpSuit?: Suit | null): boolean {
  if (currentTrick.length === 0) return true;

  const leadSuit = currentTrick[0].card.suit;
  
  // In Catch 5, you can always play trump regardless of what you have
  if (trumpSuit && card.suit === trumpSuit) {
    return true;
  }
  
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

export function applyAutoClaim(state: GameState, claimerId: string): GameState {
  const newPlayers = state.players.map(player => {
    if (player.id === claimerId) {
      const allRemainingCards = state.players.flatMap(p => p.hand);
      return {
        ...player,
        hand: [],
        tricksWon: [...player.tricksWon, ...allRemainingCards],
      };
    }
    return { ...player, hand: [] };
  });

  const scoreDetails = calculateRoundScores(newPlayers, state.teams, state.trumpSuit!);
  const bidderTeamId = newPlayers.find(p => p.id === state.bidderId)?.teamId;
  
  const newTeams = state.teams.map(team => {
    let pointsToAdd = scoreDetails.teamPoints[team.id];
    
    if (team.id === bidderTeamId && pointsToAdd < state.highBid) {
      pointsToAdd = -state.highBid;
    }
    
    return {
      ...team,
      score: team.score + pointsToAdd,
    };
  });

  const gameOver = newTeams.some(t => t.score >= state.targetScore);

  return {
    ...state,
    players: newPlayers,
    teams: newTeams,
    currentTrick: [],
    trickNumber: TOTAL_TRICKS + 1,
    phase: gameOver ? 'game-over' : 'scoring',
    roundScores: scoreDetails.teamPoints,
    roundScoreDetails: scoreDetails,
    autoClaimerId: claimerId,
  };
}

export function getWinningTeam(state: GameState): Team | null {
  const winningTeam = state.teams.find(t => t.score >= state.targetScore);
  if (winningTeam) return winningTeam;
  
  const maxScore = Math.max(...state.teams.map(t => t.score));
  const winners = state.teams.filter(t => t.score === maxScore);
  return winners.length === 1 ? winners[0] : null;
}

export function isPlayersTurn(state: GameState, playerId: string): boolean {
  return state.players[state.currentPlayerIndex].id === playerId;
}

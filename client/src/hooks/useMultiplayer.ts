import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, Card, Suit, DeckColor, ChatMessage } from '@shared/gameTypes';

interface RoomPlayer {
  seatIndex: number;
  playerName: string;
  connected: boolean;
  isCpu?: boolean;
}

interface ActiveGame {
  roomCode: string;
  playerNames: string[];
  phase: string;
  spectatorCount: number;
}

interface MultiplayerState {
  connected: boolean;
  reconnecting: boolean;
  roomCode: string | null;
  playerToken: string | null;
  seatIndex: number | null;
  players: RoomPlayer[];
  gameState: GameState | null;
  error: string | null;
  chatMessages: ChatMessage[];
  roomUnavailable: boolean;
  lastDisconnectTime: number | null;
  isSpectating: boolean;
  spectatorId: string | null;
  spectatorCount: number;
  activeGames: ActiveGame[];
}

export function useMultiplayer() {
  const [state, setState] = useState<MultiplayerState>({
    connected: false,
    reconnecting: false,
    roomCode: null,
    playerToken: null,
    seatIndex: null,
    players: [],
    gameState: null,
    error: null,
    chatMessages: [],
    roomUnavailable: false,
    lastDisconnectTime: null,
    isSpectating: false,
    spectatorId: null,
    spectatorCount: 0,
    activeGames: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    // Guard against parallel connections
    if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('[WS] Already connected or connecting, skipping');
      return;
    }
    
    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    isConnectingRef.current = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to server');
      isConnectingRef.current = false;
      setState(prev => ({ ...prev, connected: true, reconnecting: false, error: null, roomUnavailable: false }));
      reconnectAttempts.current = 0;

      const savedToken = sessionStorage.getItem('playerToken');
      const savedRoom = sessionStorage.getItem('roomCode');
      const savedName = sessionStorage.getItem('playerName');
      const savedSpectatorRoom = sessionStorage.getItem('spectatorRoomCode');
      const savedSpectatorName = sessionStorage.getItem('spectatorDisplayName');
      if (savedToken && savedRoom) {
        console.log('[WS] Attempting to rejoin room:', savedRoom);
        ws.send(JSON.stringify({
          type: 'join_room',
          roomCode: savedRoom,
          playerToken: savedToken,
          playerName: savedName || '',
        }));
      } else if (savedSpectatorRoom) {
        console.log('[WS] Attempting to re-spectate room:', savedSpectatorRoom);
        ws.send(JSON.stringify({
          type: 'spectate_room',
          roomCode: savedSpectatorRoom,
          displayName: savedSpectatorName || 'Spectator',
        }));
      }
      
      // Send pings every 20 seconds to keep connection alive through proxies/mobile networks
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000);
      
      (ws as any).pingInterval = pingInterval;
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.onclose = () => {
      console.log('[WS] Connection closed, attempt:', reconnectAttempts.current);
      isConnectingRef.current = false;
      if ((ws as any).pingInterval) {
        clearInterval((ws as any).pingInterval);
      }
      
      // Don't reconnect if intentionally disconnected
      if (intentionalDisconnectRef.current) {
        console.log('[WS] Intentional disconnect, not reconnecting');
        intentionalDisconnectRef.current = false;
        setState(prev => ({ ...prev, connected: false, reconnecting: false }));
        return;
      }
      
      setState(prev => ({ 
        ...prev, 
        connected: false,
        lastDisconnectTime: Date.now(),
        reconnecting: reconnectAttempts.current < maxReconnectAttempts,
      }));
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        const delay = 1000 * Math.pow(2, reconnectAttempts.current);
        console.log(`[WS] Reconnecting in ${delay}ms...`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        console.log('[WS] Max reconnect attempts reached');
        setState(prev => ({ ...prev, reconnecting: false, error: 'Connection lost. Please refresh the page.' }));
      }
    };

    ws.onerror = (e) => {
      console.error('[WS] WebSocket error:', e);
      isConnectingRef.current = false;
      setState(prev => ({ ...prev, error: 'Connection error' }));
    };
  }, []);

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'room_created':
      case 'joined':
        console.log('[useMultiplayer] Room created/joined:', { 
          type: message.type,
          roomCode: message.roomCode, 
          seatIndex: message.seatIndex, 
          playersReceived: message.players 
        });
        sessionStorage.setItem('playerToken', message.playerToken);
        sessionStorage.setItem('roomCode', message.roomCode);
        // Also save the player name from the players list
        const myPlayer = message.players?.find((p: any) => p.seatIndex === message.seatIndex);
        if (myPlayer?.playerName) {
          sessionStorage.setItem('playerName', myPlayer.playerName);
        }
        setState(prev => ({
          ...prev,
          roomCode: message.roomCode,
          playerToken: message.playerToken,
          seatIndex: message.seatIndex,
          players: message.players,
          error: null,
          roomUnavailable: false,
        }));
        break;

      case 'rejoined':
        console.log('[useMultiplayer] Rejoined room:', message.roomCode);
        // Update saved player name on rejoin
        const rejoiningPlayer = message.players?.find((p: any) => p.seatIndex === message.seatIndex);
        if (rejoiningPlayer?.playerName) {
          sessionStorage.setItem('playerName', rejoiningPlayer.playerName);
        }
        setState(prev => ({
          ...prev,
          roomCode: message.roomCode,
          playerToken: message.playerToken,
          seatIndex: message.seatIndex,
          players: message.players,
          gameState: message.gameState,
          chatMessages: message.chatMessages || prev.chatMessages,
          error: null,
          roomUnavailable: false,
        }));
        break;

      case 'player_joined':
      case 'player_reconnected':
      case 'player_disconnected':
        setState(prev => ({
          ...prev,
          players: message.players || prev.players,
        }));
        break;

      case 'seats_updated':
        setState(prev => ({
          ...prev,
          seatIndex: message.seatIndex,
          players: message.players || prev.players,
        }));
        break;

      case 'game_state':
        console.log('[useMultiplayer] game_state received:', {
          currentPlayerIndex: message.gameState?.currentPlayerIndex,
          phase: message.gameState?.phase,
          currentTrick: message.gameState?.currentTrick?.map((tc: any) => ({ playerId: tc.playerId, card: tc.card?.rank + tc.card?.suit })),
          playerIds: message.gameState?.players?.map((p: any) => p.id),
        });
        setState(prev => {
          console.log('[useMultiplayer] Current seatIndex:', prev.seatIndex);
          return {
            ...prev,
            gameState: message.gameState,
          };
        });
        break;

      case 'left':
        console.log('[WS] Left room');
        sessionStorage.removeItem('playerToken');
        sessionStorage.removeItem('roomCode');
        sessionStorage.removeItem('spectatorRoomCode');
        sessionStorage.removeItem('spectatorDisplayName');
        setState({
          connected: true,
          reconnecting: false,
          roomCode: null,
          playerToken: null,
          seatIndex: null,
          players: [],
          gameState: null,
          error: null,
          chatMessages: [],
          roomUnavailable: false,
          lastDisconnectTime: null,
          isSpectating: false,
          spectatorId: null,
          spectatorCount: 0,
          activeGames: [],
        });
        break;
      
      case 'room_unavailable':
        console.log('[WS] Room is no longer available');
        sessionStorage.removeItem('playerToken');
        sessionStorage.removeItem('roomCode');
        sessionStorage.removeItem('playerName');
        sessionStorage.removeItem('spectatorRoomCode');
        sessionStorage.removeItem('spectatorDisplayName');
        setState(prev => ({
          ...prev,
          roomCode: null,
          playerToken: null,
          seatIndex: null,
          players: [],
          gameState: null,
          roomUnavailable: true,
          isSpectating: false,
          spectatorId: null,
          spectatorCount: 0,
          error: message.message || 'This room is no longer available',
        }));
        break;

      case 'error':
        console.log('[WS] Error received:', message.message);
        // If the error indicates session is invalid, clear stored session data
        if (message.clearSession) {
          const savedName = sessionStorage.getItem('playerName') || 'Player';
          sessionStorage.removeItem('playerToken');
          sessionStorage.removeItem('roomCode');
          sessionStorage.removeItem('playerName');

          // Auto-rejoin if server provides the room code and flag
          if (message.autoRejoin && message.roomCode && wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('[WS] Auto-rejoining room:', message.roomCode);
            wsRef.current.send(JSON.stringify({
              type: 'join_room',
              roomCode: message.roomCode,
              playerName: savedName,
            }));
            break;
          }
        }
        // Check if this is a room unavailable error
        if (message.message?.includes('Room not found') || message.message?.includes('no longer exists')) {
          setState(prev => ({
            ...prev,
            roomCode: null,
            playerToken: null,
            seatIndex: null,
            players: [],
            gameState: null,
            roomUnavailable: true,
            error: message.message,
          }));
        } else {
          setState(prev => ({ ...prev, error: message.message }));
        }
        break;

      case 'kicked':
        // Clear session and reset state when kicked by host
        sessionStorage.removeItem('playerToken');
        sessionStorage.removeItem('roomCode');
        sessionStorage.removeItem('playerName');
        sessionStorage.removeItem('spectatorRoomCode');
        sessionStorage.removeItem('spectatorDisplayName');
        setState(prev => ({
          ...prev,
          roomCode: null,
          playerToken: null,
          seatIndex: null,
          players: [],
          gameState: null,
          isSpectating: false,
          spectatorId: null,
          spectatorCount: 0,
          error: message.message || 'You have been removed from the room',
        }));
        break;
      
      case 'pong':
        break;
      
      case 'chat_message':
        setState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages.slice(-49), message.message],
        }));
        break;

      case 'spectating':
        console.log('[WS] Now spectating room:', message.roomCode);
        sessionStorage.setItem('spectatorRoomCode', message.roomCode);
        sessionStorage.setItem('spectatorDisplayName', message.spectatorId);
        setState(prev => ({
          ...prev,
          isSpectating: true,
          spectatorId: message.spectatorId,
          roomCode: message.roomCode,
          players: message.players,
          gameState: message.gameState,
          chatMessages: message.chatMessages || [],
          spectatorCount: message.spectatorCount || 0,
          error: null,
          roomUnavailable: false,
        }));
        break;

      case 'spectator_count_updated':
        setState(prev => ({
          ...prev,
          spectatorCount: message.count,
        }));
        break;

      case 'active_games':
        setState(prev => ({
          ...prev,
          activeGames: message.games || [],
        }));
        break;
    }
  };

  useEffect(() => {
    connect();
    return () => {
      // Clear any pending reconnect timeout on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      intentionalDisconnectRef.current = true;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const createRoom = useCallback((playerName: string, deckColor: DeckColor = 'orange', targetScore: number = 25, userId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'create_room',
        playerName,
        deckColor,
        targetScore,
        userId,
      }));
    }
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string, preferredSeat?: number, userId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Clear any existing session data before joining a new room
      // to prevent stale token issues
      sessionStorage.removeItem('playerToken');
      sessionStorage.removeItem('roomCode');
      sessionStorage.removeItem('playerName');
      
      wsRef.current.send(JSON.stringify({
        type: 'join_room',
        roomCode,
        playerName,
        preferredSeat,
        userId,
      }));
    }
  }, []);

  const previewRoom = useCallback((roomCode: string): Promise<{ availableSeats: number[]; players: { seatIndex: number; playerName: string; connected: boolean; isCpu?: boolean }[] } | null> => {
    return new Promise((resolve) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }
      
      const handler = (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        if (message.type === 'room_preview') {
          wsRef.current?.removeEventListener('message', handler);
          resolve({
            availableSeats: message.availableSeats,
            players: message.players,
          });
        } else if (message.type === 'error') {
          wsRef.current?.removeEventListener('message', handler);
          setState(prev => ({ ...prev, error: message.message }));
          resolve(null);
        }
      };
      
      wsRef.current.addEventListener('message', handler);
      wsRef.current.send(JSON.stringify({
        type: 'preview_room',
        roomCode,
      }));
      
      // Timeout after 5 seconds
      setTimeout(() => {
        wsRef.current?.removeEventListener('message', handler);
        resolve(null);
      }, 5000);
    });
  }, []);

  const startGame = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start_game' }));
    }
  }, []);

  const sendAction = useCallback((action: string, data: any = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'player_action',
        action,
        data,
      }));
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_room' }));
    }
  }, []);

  const addCpu = useCallback((seatIndex: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'add_cpu', seatIndex }));
    }
  }, []);

  const removeCpu = useCallback((seatIndex: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'remove_cpu', seatIndex }));
    }
  }, []);

  const swapSeats = useCallback((seat1: number, seat2: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'swap_seats', seat1, seat2 }));
    }
  }, []);

  const randomizeTeams = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'randomize_teams' }));
    }
  }, []);

  const kickPlayer = useCallback((seatIndex: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'kick_player', seatIndex }));
    }
  }, []);

  const sendChat = useCallback((content: string, chatType: 'text' | 'emoji') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send_chat',
        content,
        chatType,
      }));
    }
  }, []);

  const spectateRoom = useCallback((roomCode: string, displayName: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Clear any existing player session
      sessionStorage.removeItem('playerToken');
      sessionStorage.removeItem('roomCode');
      sessionStorage.removeItem('playerName');

      wsRef.current.send(JSON.stringify({
        type: 'spectate_room',
        roomCode,
        displayName,
      }));
    }
  }, []);

  const leaveSpectate = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_spectate' }));
    }
    sessionStorage.removeItem('spectatorRoomCode');
    sessionStorage.removeItem('spectatorDisplayName');
  }, []);

  const listActiveGames = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'list_active_games' }));
    }
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    previewRoom,
    startGame,
    sendAction,
    leaveRoom,
    addCpu,
    removeCpu,
    swapSeats,
    randomizeTeams,
    kickPlayer,
    sendChat,
    spectateRoom,
    leaveSpectate,
    listActiveGames,
  };
}

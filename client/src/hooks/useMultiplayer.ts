import { useState, useEffect, useRef, useCallback } from 'react';
import type { GameState, Card, Suit, DeckColor, ChatMessage } from '@shared/gameTypes';

interface RoomPlayer {
  seatIndex: number;
  playerName: string;
  connected: boolean;
  isCpu?: boolean;
}

interface MultiplayerState {
  connected: boolean;
  roomCode: string | null;
  playerToken: string | null;
  seatIndex: number | null;
  players: RoomPlayer[];
  gameState: GameState | null;
  error: string | null;
  chatMessages: ChatMessage[];
}

export function useMultiplayer() {
  const [state, setState] = useState<MultiplayerState>({
    connected: false,
    roomCode: null,
    playerToken: null,
    seatIndex: null,
    players: [],
    gameState: null,
    error: null,
    chatMessages: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(prev => ({ ...prev, connected: true, error: null }));
      reconnectAttempts.current = 0;

      const savedToken = sessionStorage.getItem('playerToken');
      const savedRoom = sessionStorage.getItem('roomCode');
      const savedName = sessionStorage.getItem('playerName');
      if (savedToken && savedRoom) {
        ws.send(JSON.stringify({
          type: 'join_room',
          roomCode: savedRoom,
          playerToken: savedToken,
          playerName: savedName || '', // Send saved name for fallback if token is invalid
        }));
      }
      
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
      
      (ws as any).pingInterval = pingInterval;
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.onclose = () => {
      if ((ws as any).pingInterval) {
        clearInterval((ws as any).pingInterval);
      }
      setState(prev => ({ ...prev, connected: false }));
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setTimeout(connect, 1000 * Math.pow(2, reconnectAttempts.current));
      }
    };

    ws.onerror = () => {
      setState(prev => ({ ...prev, error: 'Connection error' }));
    };
  }, []);

  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'room_created':
      case 'joined':
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
        }));
        break;

      case 'rejoined':
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
        sessionStorage.removeItem('playerToken');
        sessionStorage.removeItem('roomCode');
        setState({
          connected: true,
          roomCode: null,
          playerToken: null,
          seatIndex: null,
          players: [],
          gameState: null,
          error: null,
          chatMessages: [],
        });
        break;

      case 'error':
        // If the error indicates session is invalid, clear stored session data
        if (message.clearSession) {
          sessionStorage.removeItem('playerToken');
          sessionStorage.removeItem('roomCode');
          sessionStorage.removeItem('playerName');
        }
        setState(prev => ({ ...prev, error: message.message }));
        break;
      
      case 'pong':
        break;
      
      case 'chat_message':
        setState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages.slice(-49), message.message],
        }));
        break;
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const createRoom = useCallback((playerName: string, deckColor: DeckColor = 'orange', targetScore: number = 25) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'create_room',
        playerName,
        deckColor,
        targetScore,
      }));
    }
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string) => {
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
      }));
    }
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

  const sendChat = useCallback((content: string, chatType: 'text' | 'emoji') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'send_chat',
        content,
        chatType,
      }));
    }
  }, []);

  return {
    ...state,
    createRoom,
    joinRoom,
    startGame,
    sendAction,
    leaveRoom,
    addCpu,
    removeCpu,
    swapSeats,
    randomizeTeams,
    sendChat,
  };
}

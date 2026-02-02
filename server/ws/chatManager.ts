import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { ChatMessage } from '@shared/gameTypes';
import { rooms, playerConnections, spectatorConnections, safeSend, getRoomById } from './state';
import type { GameRoom } from './types';

export async function handleSendChat(ws: WebSocket, message: any) {
  const player = playerConnections.get(ws);
  const spectator = spectatorConnections.get(ws);

  if (!player && !spectator) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' }));
    return;
  }

  let room: GameRoom | undefined;
  let senderId: string;
  let senderName: string;

  if (player) {
    room = getRoomById(player.roomId);
    senderId = `player${player.seatIndex + 1}`;
    senderName = player.playerName;
  } else {
    room = rooms.get(spectator!.roomCode);
    senderId = `spectator_${spectator!.spectatorId}`;
    senderName = spectator!.displayName;
  }

  if (!room) {
    ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
    return;
  }

  const { chatType, content } = message;

  if (!content || typeof content !== 'string') {
    return;
  }

  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return;
  }

  const sanitizedContent = trimmedContent.slice(0, 200);

  const chatMessage: ChatMessage = {
    id: randomUUID(),
    senderId,
    senderName,
    type: chatType === 'emoji' ? 'emoji' : 'text',
    content: sanitizedContent,
    timestamp: Date.now(),
  };

  room.chatMessages.push(chatMessage);
  if (room.chatMessages.length > 50) {
    room.chatMessages = room.chatMessages.slice(-50);
  }

  const chatData = JSON.stringify({ type: 'chat_message', message: chatMessage });
  const allPlayers = Array.from(room.players.values());
  for (const p of allPlayers) {
    safeSend(p.ws, chatData);
  }
  const allSpectators = Array.from(room.spectators.values());
  for (const s of allSpectators) {
    safeSend(s.ws, chatData);
  }
}

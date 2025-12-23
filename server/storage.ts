import { 
  type User, 
  type InsertUser, 
  type GameRoom, 
  type InsertGameRoom,
  type RoomPlayer,
  type InsertRoomPlayer,
  users,
  gameRooms,
  roomPlayers
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createRoom(room: InsertGameRoom): Promise<GameRoom>;
  getRoomByCode(code: string): Promise<GameRoom | undefined>;
  getRoomById(id: string): Promise<GameRoom | undefined>;
  updateRoom(id: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined>;
  deleteRoom(id: string): Promise<void>;
  
  addPlayerToRoom(player: InsertRoomPlayer): Promise<RoomPlayer>;
  getPlayersInRoom(roomId: string): Promise<RoomPlayer[]>;
  getPlayerByToken(token: string): Promise<RoomPlayer | undefined>;
  updatePlayer(id: string, updates: Partial<RoomPlayer>): Promise<RoomPlayer | undefined>;
  removePlayerFromRoom(playerId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createRoom(insertRoom: InsertGameRoom): Promise<GameRoom> {
    const result = await db.insert(gameRooms).values(insertRoom).returning();
    return result[0];
  }

  async getRoomByCode(code: string): Promise<GameRoom | undefined> {
    const result = await db.select().from(gameRooms).where(eq(gameRooms.code, code));
    return result[0];
  }

  async getRoomById(id: string): Promise<GameRoom | undefined> {
    const result = await db.select().from(gameRooms).where(eq(gameRooms.id, id));
    return result[0];
  }

  async updateRoom(id: string, updates: Partial<GameRoom>): Promise<GameRoom | undefined> {
    const result = await db.update(gameRooms).set(updates).where(eq(gameRooms.id, id)).returning();
    return result[0];
  }

  async deleteRoom(id: string): Promise<void> {
    await db.delete(roomPlayers).where(eq(roomPlayers.roomId, id));
    await db.delete(gameRooms).where(eq(gameRooms.id, id));
  }

  async addPlayerToRoom(insertPlayer: InsertRoomPlayer): Promise<RoomPlayer> {
    const result = await db.insert(roomPlayers).values(insertPlayer).returning();
    return result[0];
  }

  async getPlayersInRoom(roomId: string): Promise<RoomPlayer[]> {
    return await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  }

  async getPlayerByToken(token: string): Promise<RoomPlayer | undefined> {
    const result = await db.select().from(roomPlayers).where(eq(roomPlayers.playerToken, token));
    return result[0];
  }

  async updatePlayer(id: string, updates: Partial<RoomPlayer>): Promise<RoomPlayer | undefined> {
    const result = await db.update(roomPlayers).set(updates).where(eq(roomPlayers.id, id)).returning();
    return result[0];
  }

  async removePlayerFromRoom(playerId: string): Promise<void> {
    await db.delete(roomPlayers).where(eq(roomPlayers.id, playerId));
  }
}

export const storage = new DatabaseStorage();

const { v4: uuidv4 } = require('uuid');
const { Session } = require('../models');
const redis = require('redis');

class SessionService {
  constructor() {
    this.redisClient = null;
    this.inMemorySessions = new Map(); // Fallback only if Redis unavailable
    this.redisConnected = false;
    this.redisInitialized = false;
    // Initialize Redis in background without blocking
    this.initializeRedis().catch(err => {
      console.error('Redis initialization failed:', err);
    });
  }

  async initializeRedis() {
    try {
      this.redisClient = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB || '0'),
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.redisConnected = false;
        this.redisInitialized = true;
      });

      this.redisClient.on('connect', () => {
        console.log('Redis Client Connected');
        this.redisConnected = true;
        this.redisInitialized = true;
      });

      await this.redisClient.connect();
      this.redisInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Redis, using in-memory fallback:', error);
      this.redisConnected = false;
      this.redisInitialized = true;
    }
  }

  async createGuestSession(ipAddress = null) {
    const guestSessionId = uuidv4();
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      guestSessionId,
      type: 'guest',
      quizCount: 0,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      metadata: {
        ipAddress: ipAddress || null,
        createdAt: new Date().toISOString(),
      },
    };

    // Check if this IP has already exceeded the guest limit (only if Redis is available and initialized)
    if (ipAddress && this.redisConnected && this.redisClient && this.redisInitialized) {
      try {
        const ipKey = `ip:${ipAddress}`;
        const ipData = await this.redisClient.get(ipKey);
        if (ipData) {
          const ipSession = JSON.parse(ipData);
          if (ipSession.quizCount >= 2) {
            console.log(`IP ${ipAddress} has exceeded guest limit (${ipSession.quizCount} quizzes)`);
            // Return the existing session instead of creating a new one
            return { session: ipSession, limitReached: true };
          }
        }
      } catch (error) {
        console.error('Failed to check IP limit:', error);
      }
    }

    // Try Redis first if available and initialized
    if (this.redisConnected && this.redisClient && this.redisInitialized) {
      try {
        const ttl = 24 * 60 * 60; // 24 hours in seconds
        await this.redisClient.setEx(sessionId, ttl, JSON.stringify(session));
        
        // Also store by IP for limit tracking
        if (ipAddress) {
          const ipKey = `ip:${ipAddress}`;
          await this.redisClient.setEx(ipKey, ttl, JSON.stringify(session));
        }
        
        return { session, limitReached: false };
      } catch (error) {
        console.error('Failed to create session in Redis, using in-memory fallback:', error);
      }
    }

    // Fallback to in-memory (always works)
    console.log('Using in-memory session storage');
    this.inMemorySessions.set(sessionId, session);
    return { session, limitReached: false };
  }

  async getSession(sessionId) {
    // Try Redis first
    if (this.redisConnected && this.redisClient) {
      try {
        const data = await this.redisClient.get(sessionId);
        if (data) {
          const session = JSON.parse(data);
          // Check if expired
          if (new Date(session.expiresAt) < new Date()) {
            await this.deleteSession(sessionId);
            return null;
          }
          return session;
        }
      } catch (error) {
        console.error('Failed to get session from Redis, using in-memory fallback:', error);
      }
    }

    // Fallback to in-memory
    const inMemorySession = this.inMemorySessions.get(sessionId);
    if (inMemorySession) {
      // Check if expired
      if (new Date(inMemorySession.expiresAt) < new Date()) {
        this.inMemorySessions.delete(sessionId);
        return null;
      }
      return inMemorySession;
    }

    return null;
  }

  async incrementQuizCount(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    session.quizCount += 1;

    // Try Redis first
    if (this.redisConnected && this.redisClient) {
      try {
        const ttl = Math.max(1, Math.floor((new Date(session.expiresAt) - new Date()) / 1000));
        await this.redisClient.setEx(sessionId, ttl, JSON.stringify(session));
        
        // Also update IP tracking if IP exists
        if (session.metadata?.ipAddress) {
          const ipKey = `ip:${session.metadata.ipAddress}`;
          await this.redisClient.setEx(ipKey, ttl, JSON.stringify(session));
        }
        
        return session;
      } catch (error) {
        console.error('Failed to increment quiz count in Redis, using in-memory fallback:', error);
      }
    }

    // Fallback to in-memory
    this.inMemorySessions.set(sessionId, session);
    return session;
  }

  async updateMetadata(sessionId, metadata) {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    session.metadata = { ...session.metadata, ...metadata };

    // Try Redis first
    if (this.redisConnected && this.redisClient) {
      try {
        const ttl = Math.max(1, Math.floor((new Date(session.expiresAt) - new Date()) / 1000));
        await this.redisClient.setEx(sessionId, ttl, JSON.stringify(session));
        return session;
      } catch (error) {
        console.error('Failed to update metadata in Redis, using in-memory fallback:', error);
      }
    }

    // Fallback to in-memory
    this.inMemorySessions.set(sessionId, session);
    return session;
  }

  async deleteSession(sessionId) {
    // Try Redis first
    if (this.redisConnected && this.redisClient) {
      try {
        await this.redisClient.del(sessionId);
      } catch (error) {
        console.error('Failed to delete session from Redis:', error);
      }
    }

    // Fallback to in-memory
    this.inMemorySessions.delete(sessionId);
  }

  async cleanupExpiredSessions() {
    // Redis handles TTL automatically, so no manual cleanup needed for Redis
    // Only cleanup in-memory sessions
    const now = new Date();
    for (const [sessionId, session] of this.inMemorySessions.entries()) {
      if (new Date(session.expiresAt) < now) {
        this.inMemorySessions.delete(sessionId);
      }
    }
  }
}

module.exports = new SessionService();

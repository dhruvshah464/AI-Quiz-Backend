const sessionService = require('../services/session.service');
const analyticsService = require('../services/analytics.service');

/**
 * Extract client IP address from request
 */
const getClientIp = (req) => {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         null;
};

/**
 * Create a new guest session
 */
const createGuestSession = async (req, res) => {
  try {
    const ipAddress = getClientIp(req);
    const result = await sessionService.createGuestSession(ipAddress);
    
    if (result.limitReached) {
      // Track guest limit reached
      analyticsService.trackGuestLimitReached(ipAddress);
      
      return res.status(429).json({
        message: 'Guest limit reached for this IP address',
        session: result.session,
        limitReached: true,
      });
    }
    
    // Track guest session created
    analyticsService.trackGuestSessionCreated(ipAddress);
    
    res.status(201).json({
      message: 'Guest session created successfully',
      session: result.session,
      limitReached: false,
    });
  } catch (error) {
    console.error('Failed to create guest session:', error);
    res.status(500).json({ message: 'Failed to create guest session' });
  }
};

/**
 * Get session by ID
 */
const getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionService.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found or expired' });
    }
    
    res.json({
      message: 'Session retrieved successfully',
      session: {
        id: session.id,
        guestSessionId: session.guestSessionId,
        type: session.type,
        quizCount: session.quizCount,
        expiresAt: session.expiresAt,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ 
      message: 'Error fetching session', 
      error: error.message 
    });
  }
};

module.exports = {
  createGuestSession,
  getSession,
};

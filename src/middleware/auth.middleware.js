const { verifyToken } = require('../utils/jwt.util');
const sessionService = require('../services/session.service');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionId = req.headers['x-session-id'];
    const isGuestMode = req.headers['x-guest-mode'] === 'true';

    // Priority 1: JWT token authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      req.user = decoded;
      req.session = null;
      return next();
    }

    // Priority 2: Session-based authentication (for guests or session tracking)
    if (sessionId) {
      const session = await sessionService.getSession(sessionId);
      
      if (!session) {
        return res.status(401).json({ message: 'Session not found or expired' });
      }

      req.user = {
        id: session.userId || session.guestSessionId,
        sessionId: session.id,
        type: session.type,
        username: session.type === 'guest' ? 'Guest User' : 'User',
      };
      
      req.session = session;
      return next();
    }

    // Priority 3: Legacy guest mode (for backward compatibility)
    if (isGuestMode) {
      req.user = {
        id: 'guest',
        username: 'Guest User',
      };
      req.session = null;
      return next();
    }

    return res.status(401).json({ message: 'No authentication provided' });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

module.exports = authMiddleware;

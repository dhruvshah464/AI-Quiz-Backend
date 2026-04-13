const bcrypt = require('bcryptjs');
const { User, Session } = require('../models');
const { generateToken } = require('../utils/jwt.util');
const analyticsService = require('../services/analytics.service');

const googleCallback = (req, res) => {
  try {
    const token = generateToken(req.user);
    
    // Track user logged in via Google OAuth
    analyticsService.trackUserLoggedIn(req.user.id, 'google');
    
    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth_failed`);
  }
};

const register = async (req, res) => {
  try {
    const { username, password, email, gradeLevel, guestSessionId } = req.body;
    console.log('Registration attempt:', { username, email, gradeLevel, guestSessionId });

    // Mock authentication - accept any username/password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = {
      username,
      password: hashedPassword,
    };
    
    if (email) userData.email = email;
    if (gradeLevel) userData.gradeLevel = gradeLevel;

    const user = await User.create(userData);
    console.log('User created:', user.toJSON());

    // If guest session ID provided, migrate guest data to user
    if (guestSessionId) {
      try {
        const session = await Session.findOne({ where: { id: guestSessionId } });
        if (session && session.type === 'guest') {
          console.log('Migrating guest session data to user:', guestSessionId);
          // Update session to link to user
          await session.update({ userId: user.id, type: 'user' });
          console.log('Guest session migrated successfully');
          
          // Track guest conversion
          analyticsService.trackGuestConversion(user.id, guestSessionId);
        }
      } catch (migrationError) {
        console.error('Guest session migration failed:', migrationError);
        // Continue with registration even if migration fails
      }
    }

    const token = generateToken(user);

    // Track user registered
    analyticsService.trackUserRegistered(user.id, 'email');

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        gradeLevel: user.gradeLevel,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Error registering user', 
      error: error.message,
      details: error.errors ? error.errors.map(e => e.message) : undefined
    });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt:', { username });

    // Mock authentication - accept any username/password
    const user = await User.findOne({ where: { username } });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    // Track user logged in
    analyticsService.trackUserLoggedIn(user.id, 'email');

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        gradeLevel: user.gradeLevel,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

module.exports = {
  register,
  login,
  googleCallback,
};

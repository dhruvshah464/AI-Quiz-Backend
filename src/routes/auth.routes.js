const router = require('express').Router();
const authController = require('../controllers/auth.controller');
const passport = require('../config/googleOAuth.config');

// Google OAuth routes
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    authController.googleCallback
  );
} else {
  console.warn('Google OAuth credentials not configured. Google OAuth routes disabled.');
}

router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;

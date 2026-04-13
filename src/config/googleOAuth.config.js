const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models');
const { generateToken } = require('../utils/jwt.util');

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('Google OAuth credentials not set. Google OAuth will be disabled.');
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({
          where: { googleId: profile.id },
        });

        if (user) {
          return done(null, user);
        }

        // Check if user exists with same email
        if (profile.emails && profile.emails.length > 0) {
          user = await User.findOne({
            where: { email: profile.emails[0].value },
          });

          if (user) {
            // Link Google account to existing user
            await user.update({ googleId: profile.id });
            return done(null, user);
          }
        }

        // Create new user
        user = await User.create({
          googleId: profile.id,
          username: profile.displayName || profile.emails[0].value.split('@')[0],
          email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
          // Other fields can be set as needed
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;

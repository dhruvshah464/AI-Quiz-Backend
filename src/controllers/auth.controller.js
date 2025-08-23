const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { generateToken } = require('../utils/jwt.util');

const register = async (req, res) => {
  try {
    const { username, password, email, gradeLevel } = req.body;
    console.log('Registration attempt:', { username, email, gradeLevel });

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

    const token = generateToken(user);

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

    // Mock authentication - accept any username/password
    let user = await User.findOne({ where: { username } });
    
    if (!user) {
      // For mock auth, create user if not exists
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await User.create({
        username,
        password: hashedPassword,
      });
    }

    const token = generateToken(user);

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
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};

module.exports = {
  register,
  login,
};

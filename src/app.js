require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const swaggerUi = require('swagger-ui-express');
const swaggerDefinition = require('./config/swagger');
const db = require('./models');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

// Routes
const authRoutes = require('./routes/auth.routes');
const quizRoutes = require('./routes/quiz.routes');
const sessionRoutes = require('./routes/session.routes');

app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/session', sessionRoutes);

// Basic error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;

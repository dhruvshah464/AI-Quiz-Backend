const { Sequelize } = require('sequelize');
require('dotenv').config();

// Use SQLite for easier local development
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './quiz.db',
  logging: console.log,
});

module.exports = sequelize;

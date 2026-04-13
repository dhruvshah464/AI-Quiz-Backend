const { Sequelize } = require('sequelize');
const config = require('../config/config.js')[process.env.NODE_ENV || 'development'];

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    logging: false,
  }
);

const db = {
  sequelize,
  Sequelize,
  User: require('./user.model')(sequelize, Sequelize),
  Quiz: require('./quiz.model')(sequelize, Sequelize),
  Question: require('./question.model')(sequelize, Sequelize),
  Session: require('./session.model')(sequelize, Sequelize),
  Attempt: require('./attempt.model')(sequelize, Sequelize),
};

// Set up associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    await sequelize.sync();
    console.log('Database synced successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

testConnection();

module.exports = db;

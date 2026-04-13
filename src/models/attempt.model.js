module.exports = (sequelize, DataTypes) => {
  const Attempt = sequelize.define('Attempt', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    quizId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    answers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    score: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    weakAreas: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    strengths: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    confidenceLevel: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
    },
    nextSteps: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  Attempt.associate = (models) => {
    Attempt.belongsTo(models.Quiz, {
      foreignKey: 'quizId',
      as: 'quiz',
    });
    Attempt.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  };

  return Attempt;
};

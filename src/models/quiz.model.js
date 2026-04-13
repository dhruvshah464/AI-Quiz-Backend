module.exports = (sequelize, DataTypes) => {
  const Quiz = sequelize.define('Quiz', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    topics: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    gradeLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    difficulty: {
      type: DataTypes.ENUM('easy', 'medium', 'hard'),
      allowNull: false,
    },
    totalQuestions: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isCompleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    score: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    performanceData: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  });

  Quiz.associate = (models) => {
    Quiz.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Quiz.hasMany(models.Question, {
      foreignKey: 'quizId',
      as: 'questions',
    });
    Quiz.hasMany(models.Attempt, {
      foreignKey: 'quizId',
      as: 'attempts',
    });
  };

  return Quiz;
};

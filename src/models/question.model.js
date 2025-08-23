module.exports = (sequelize, DataTypes) => {
  const Question = sequelize.define('Question', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    quizId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    options: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    correctAnswer: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userAnswer: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    difficulty: {
      type: DataTypes.ENUM('easy', 'medium', 'hard'),
      allowNull: false,
    },
    aiHint: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  Question.associate = (models) => {
    Question.belongsTo(models.Quiz, {
      foreignKey: 'quizId',
      as: 'quiz',
    });
  };

  return Question;
};

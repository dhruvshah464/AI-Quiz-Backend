module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    guestSessionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('user', 'guest'),
      allowNull: false,
    },
    quizCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  }, {
    tableName: 'sessions',
    timestamps: true,
  });

  Session.associate = (models) => {
    Session.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Session;
};

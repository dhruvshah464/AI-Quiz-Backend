module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: {
          msg: 'Invalid email format',
          args: true,
        },
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gradeLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        isInt: {
          msg: 'Grade level must be an integer',
        },
        min: {
          args: 1,
          msg: 'Grade level must be at least 1',
        },
        max: {
          args: 12,
          msg: 'Grade level must be at most 12',
        },
      },
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
  });

  User.associate = (models) => {
    User.hasMany(models.Quiz, {
      foreignKey: 'userId',
      as: 'quizzes',
    });
  };

  return User;
};

const { Attempt, Quiz } = require('../models');

class LearningIntelligenceService {
  /**
   * Analyze user's quiz attempt to identify weak and strong areas
   */
  analyzeAttempt(quiz, answers) {
    const weakAreas = [];
    const strengths = [];
    const difficultyPerformance = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 },
    };

    quiz.questions.forEach((question) => {
      const answer = answers.find((a) => a.questionId === question.id);
      if (answer) {
        const isCorrect = question.correctAnswer === answer.answer;
        
        // Track difficulty performance
        if (difficultyPerformance[question.difficulty]) {
          difficultyPerformance[question.difficulty].total++;
          if (isCorrect) difficultyPerformance[question.difficulty].correct++;
        }

        // Track concept performance
        if (question.concept) {
          if (isCorrect) {
            if (!strengths.includes(question.concept)) {
              strengths.push(question.concept);
            }
          } else {
            if (!weakAreas.includes(question.concept)) {
              weakAreas.push(question.concept);
            }
          }
        }
      }
    });

    return {
      weakAreas,
      strengths,
      difficultyPerformance,
    };
  }

  /**
   * Determine confidence level based on score
   */
  determineConfidenceLevel(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  /**
   * Calculate recommended difficulty progression
   */
  calculateNextDifficulty(currentDifficulty, score, difficultyPerformance) {
    // If score is very high, increase difficulty
    if (score >= 80) {
      if (currentDifficulty === 'easy') return 'medium';
      if (currentDifficulty === 'medium') return 'hard';
    }
    
    // If score is very low, decrease difficulty
    if (score < 50) {
      if (currentDifficulty === 'hard') return 'medium';
      if (currentDifficulty === 'medium') return 'easy';
    }

    // Otherwise, maintain current difficulty
    return currentDifficulty;
  }

  /**
   * Generate adaptive quiz parameters based on user's learning history
   */
  async generateAdaptiveQuizParams(userId, subject) {
    try {
      // Get user's recent attempts for this subject
      const recentAttempts = await Attempt.findAll({
        where: { userId },
        include: [
          {
            model: Quiz,
            as: 'quiz',
            where: { subject },
            required: true,
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: 5,
      });

      if (recentAttempts.length === 0) {
        // First quiz for this subject - use default parameters
        return {
          difficulty: 'medium',
          weakAreas: [],
          recommendedTopics: [subject],
        };
      }

      // Analyze recent performance
      const avgScore = recentAttempts.reduce((sum, a) => sum + a.score, 0) / recentAttempts.length;
      const allWeakAreas = [...new Set(recentAttempts.flatMap((a) => a.weakAreas))];
      const allStrengths = [...new Set(recentAttempts.flatMap((a) => a.strengths))];

      // Determine difficulty based on average performance
      let difficulty = 'medium';
      if (avgScore >= 80) difficulty = 'hard';
      else if (avgScore < 50) difficulty = 'easy';

      // Focus on weak areas if they exist
      const weakAreas = allWeakAreas.slice(0, 3); // Focus on top 3 weak areas

      return {
        difficulty,
        weakAreas,
        recommendedTopics: weakAreas.length > 0 ? weakAreas : [subject],
        avgScore,
      };
    } catch (error) {
      console.error('Error generating adaptive quiz params:', error);
      // Return default parameters on error
      return {
        difficulty: 'medium',
        weakAreas: [],
        recommendedTopics: [subject],
      };
    }
  }

  /**
   * Generate next steps for user based on quiz performance
   */
  generateNextSteps(score, weakAreas, strengths, subject) {
    const nextSteps = [];

    if (score < 50) {
      nextSteps.push('Review fundamental concepts in your weak areas');
      nextSteps.push('Practice with easier difficulty questions');
      nextSteps.push('Use hints and explanations to understand concepts');
    } else if (score >= 50 && score < 80) {
      nextSteps.push('Continue practicing to strengthen your understanding');
      nextSteps.push('Focus on weak areas while maintaining strengths');
      nextSteps.push('Try questions of similar difficulty');
    } else {
      nextSteps.push('Challenge yourself with harder questions');
      nextSteps.push('Explore advanced topics in your strong areas');
      nextSteps.push('Help others by explaining concepts');
    }

    if (weakAreas.length > 0) {
      nextSteps.push(`Focus on improving: ${weakAreas.slice(0, 2).join(', ')}`);
    }

    return nextSteps;
  }

  /**
   * Get user's learning progress summary
   */
  async getLearningProgress(userId) {
    try {
      const attempts = await Attempt.findAll({
        where: { userId },
        include: [
          {
            model: Quiz,
            as: 'quiz',
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: 20,
      });

      if (attempts.length === 0) {
        return {
          totalQuizzes: 0,
          avgScore: 0,
          weakAreas: [],
          strengths: [],
          trend: 'neutral',
        };
      }

      const totalQuizzes = attempts.length;
      const avgScore = attempts.reduce((sum, a) => sum + a.score, 0) / totalQuizzes;
      const allWeakAreas = [...new Set(attempts.flatMap((a) => a.weakAreas))];
      const allStrengths = [...new Set(attempts.flatMap((a) => a.strengths))];

      // Calculate trend (improving, declining, or neutral)
      const recentScores = attempts.slice(0, 5).map((a) => a.score);
      const olderScores = attempts.slice(5, 10).map((a) => a.score);
      
      let trend = 'neutral';
      if (recentScores.length >= 3 && olderScores.length >= 3) {
        const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
        const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
        if (recentAvg > olderAvg + 10) trend = 'improving';
        else if (recentAvg < olderAvg - 10) trend = 'declining';
      }

      return {
        totalQuizzes,
        avgScore,
        weakAreas: allWeakAreas.slice(0, 5),
        strengths: allStrengths.slice(0, 5),
        trend,
      };
    } catch (error) {
      console.error('Error getting learning progress:', error);
      return {
        totalQuizzes: 0,
        avgScore: 0,
        weakAreas: [],
        strengths: [],
        trend: 'neutral',
      };
    }
  }
}

module.exports = new LearningIntelligenceService();

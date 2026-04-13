const { Quiz, Question, Attempt } = require('../models');
const { Op } = require('sequelize');
const aiService = require('../services/ai.service');
const learningService = require('../services/learning.service');
const sessionService = require('../services/session.service');
const analyticsService = require('../services/analytics.service');

const generateQuiz = async (req, res) => {
  try {
    const { subject, gradeLevel, totalQuestions = 5, weakAreas = [] } = req.body;
    const userId = req.user.id;
    const sessionId = req.session?.id;
    const isGuestSession = req.session?.type === 'guest';

    console.log('Generating quiz:', { subject, gradeLevel, totalQuestions, userId, sessionId, isGuestSession, weakAreas });

    let difficulty;
    let adaptiveWeakAreas = weakAreas;

    // For authenticated users, use adaptive learning
    if (!isGuestSession) {
      const adaptiveParams = await learningService.generateAdaptiveQuizParams(userId, subject);
      difficulty = adaptiveParams.difficulty;
      adaptiveWeakAreas = adaptiveParams.weakAreas.length > 0 ? adaptiveParams.weakAreas : weakAreas;
    } else {
      // For guest sessions, determine difficulty based on grade level
      difficulty = gradeLevel <= 4 ? 'easy' : gradeLevel <= 8 ? 'medium' : 'hard';
    }

    // Generate questions using AI service
    let questions;
    let aiSuccess = true;
    let aiFallbackUsed = false;
    try {
      const aiResponse = await aiService.generateQuizQuestions({
        topic: subject,
        difficulty,
        numberOfQuestions: totalQuestions,
        weakAreas: adaptiveWeakAreas,
      });
      questions = aiResponse.questions;
    } catch (aiError) {
      console.error('AI generation failed, using fallback:', aiError);
      aiSuccess = false;
      aiFallbackUsed = true;
      // Fallback to mock generation if AI fails
      questions = generateFallbackQuestions(subject, gradeLevel, totalQuestions);
    }

    if (isGuestSession) {
      // Check guest limit (max 2 quizzes)
      if (req.session.quizCount >= 2) {
        return res.status(403).json({
          message: 'Guest limit reached',
          error: 'You have reached the maximum number of free quizzes. Sign up to continue.',
        });
      }

      // Increment quiz count for guest session
      await sessionService.incrementQuizCount(sessionId);

      // For guest sessions, return quiz data without saving to database
      const quizData = {
        id: `guest-${Date.now()}`,
        sessionId,
        userId: 'guest',
        subject,
        gradeLevel,
        difficulty,
        totalQuestions,
        isCompleted: false,
        score: null,
        completedAt: null,
        questions: questions.map((q, index) => ({
          id: `guest-q-${index}`,
          quizId: `guest-${Date.now()}`,
          content: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          concept: q.concept,
          tags: q.tags,
          difficulty: q.difficulty,
          userAnswer: null,
          isCorrect: null,
          aiHint: null,
        })),
      };

      // Track AI generation
      analyticsService.trackAIGeneratedQuiz(null, aiSuccess, aiFallbackUsed);
      
      // Track quiz started
      analyticsService.trackQuizStarted(null, quizData);

      res.status(201).json({
        message: 'Quiz generated successfully',
        quiz: quizData,
        remainingQuizzes: Math.max(0, 2 - (req.session.quizCount + 1)),
      });
    } else {
      // Create quiz for authenticated users
      const quiz = await Quiz.create({
        userId,
        sessionId,
        subject,
        title: `${subject} Quiz - Grade ${gradeLevel}`,
        topics: [subject],
        gradeLevel,
        difficulty,
        totalQuestions,
      });

      // Create questions
      await Promise.all(
        questions.map((q) =>
          Question.create({
            quizId: quiz.id,
            content: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            concept: q.concept,
            tags: q.tags,
            difficulty: q.difficulty,
          })
        )
      );

      // Load questions
      const quizWithQuestions = await Quiz.findByPk(quiz.id, {
        include: [{
          model: Question,
          as: 'questions',
          attributes: ['id', 'content', 'options', 'explanation', 'concept', 'tags', 'difficulty'],
        }],
      });

      // Track AI generation
      analyticsService.trackAIGeneratedQuiz(userId, aiSuccess, aiFallbackUsed);
      
      // Track quiz started
      analyticsService.trackQuizStarted(userId, {
        id: quiz.id,
        subject,
        gradeLevel,
        totalQuestions,
        difficulty,
        sessionId,
      });

      res.status(201).json({
        message: 'Quiz generated successfully',
        quiz: quizWithQuestions,
      });
    }
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ message: 'Error generating quiz', error: error.message });
  }
};

const generateRevisionQuiz = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.session?.id;
    const isGuestSession = req.session?.type === 'guest';

    if (isGuestSession) {
      return res.status(403).json({
        message: 'Revision mode is available for registered users only',
        error: 'Please sign up to access revision mode',
      });
    }

    // Get user's learning progress to identify weak areas
    const progress = await learningService.getLearningProgress(userId);
    
    if (!progress.weakAreas || progress.weakAreas.length === 0) {
      return res.status(400).json({
        message: 'No weak areas identified yet',
        error: 'Complete a few quizzes first to generate a revision quiz based on your performance',
      });
    }

    // Get most recent quiz to use as reference for subject and grade level
    const recentQuiz = await Quiz.findOne({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });

    if (!recentQuiz) {
      return res.status(400).json({
        message: 'No previous quizzes found',
        error: 'Complete a quiz first to generate a revision quiz',
      });
    }

    const subject = recentQuiz.subject;
    const gradeLevel = recentQuiz.gradeLevel;
    const totalQuestions = 10; // Revision quizzes have more questions
    const weakAreas = progress.weakAreas;

    console.log('Generating revision quiz:', { subject, gradeLevel, totalQuestions, weakAreas });

    // Use adaptive learning to get difficulty and weak areas
    const adaptiveParams = await learningService.generateAdaptiveQuizParams(userId, subject);
    const difficulty = adaptiveParams.difficulty;
    const adaptiveWeakAreas = adaptiveParams.weakAreas.length > 0 ? adaptiveParams.weakAreas : weakAreas;

    // Generate questions using AI service
    let questions;
    let aiSuccess = true;
    let aiFallbackUsed = false;
    try {
      const aiResponse = await aiService.generateQuizQuestions({
        topic: subject,
        difficulty,
        numberOfQuestions: totalQuestions,
        weakAreas: adaptiveWeakAreas,
      });
      questions = aiResponse.questions;
    } catch (aiError) {
      console.error('AI generation failed, using fallback:', aiError);
      aiSuccess = false;
      aiFallbackUsed = true;
      questions = generateFallbackQuestions(subject, gradeLevel, totalQuestions);
    }

    // Create quiz for authenticated users
    const quiz = await Quiz.create({
      userId,
      sessionId,
      subject,
      title: `${subject} Revision Quiz - Grade ${gradeLevel}`,
      topics: weakAreas,
      gradeLevel,
      difficulty,
      totalQuestions,
      isRevision: true,
    });

    // Create questions
    await Promise.all(
      questions.map((q) =>
        Question.create({
          quizId: quiz.id,
          content: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          concept: q.concept,
          tags: q.tags,
          difficulty: q.difficulty,
        })
      )
    );

    // Load questions
    const quizWithQuestions = await Quiz.findByPk(quiz.id, {
      include: [{
        model: Question,
        as: 'questions',
        attributes: ['id', 'content', 'options', 'explanation', 'concept', 'tags', 'difficulty'],
      }],
    });

    // Track AI generation
    analyticsService.trackAIGeneratedQuiz(userId, aiSuccess, aiFallbackUsed);
    
    // Track quiz started
    analyticsService.trackQuizStarted(userId, {
      id: quiz.id,
      subject,
      gradeLevel,
      totalQuestions,
      difficulty,
      sessionId,
      isRevision: true,
    });

    res.status(201).json({
      message: 'Revision quiz generated successfully',
      quiz: quizWithQuestions,
      weakAreas: adaptiveWeakAreas,
    });
  } catch (error) {
    console.error('Error generating revision quiz:', error);
    res.status(500).json({ message: 'Error generating revision quiz', error: error.message });
  }
};

const getDailyChallenge = async (req, res) => {
  try {
    const userId = req.user.id;
    const isGuestSession = req.session?.type === 'guest';

    if (isGuestSession) {
      return res.status(403).json({
        message: 'Daily challenge is available for registered users only',
        error: 'Please sign up to access daily challenges',
      });
    }

    // Get today's date string (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    const dailyChallengeId = `daily-${today}`;

    // Check if daily challenge already exists for today
    let dailyChallenge = await Quiz.findOne({
      where: { id: dailyChallengeId },
      include: ['questions'],
    });

    if (!dailyChallenge) {
      // Generate a new daily challenge
      const subjects = ['Math', 'Science', 'History', 'English', 'Geography'];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const gradeLevel = 6; // Middle school level for daily challenges
      const totalQuestions = 5;
      const difficulty = 'medium';

      console.log('Generating daily challenge:', { subject, gradeLevel, totalQuestions, difficulty });

      // Generate questions using AI service
      let questions;
      let aiSuccess = true;
      let aiFallbackUsed = false;
      try {
        const aiResponse = await aiService.generateQuizQuestions({
          topic: subject,
          difficulty,
          numberOfQuestions: totalQuestions,
          weakAreas: [],
        });
        questions = aiResponse.questions;
      } catch (aiError) {
        console.error('AI generation failed, using fallback:', aiError);
        aiSuccess = false;
        aiFallbackUsed = true;
        questions = generateFallbackQuestions(subject, gradeLevel, totalQuestions);
      }

      // Create daily challenge quiz (no userId, it's shared)
      dailyChallenge = await Quiz.create({
        id: dailyChallengeId,
        userId: null, // No specific user, shared by all
        sessionId: null,
        subject,
        title: `Daily Challenge - ${subject}`,
        topics: [subject],
        gradeLevel,
        difficulty,
        totalQuestions,
        isDailyChallenge: true,
        isCompleted: false,
      });

      // Create questions
      await Promise.all(
        questions.map((q) =>
          Question.create({
            quizId: dailyChallenge.id,
            content: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            concept: q.concept,
            tags: q.tags,
            difficulty: q.difficulty,
          })
        )
      );

      // Reload with questions
      dailyChallenge = await Quiz.findByPk(dailyChallengeId, {
        include: [{
          model: Question,
          as: 'questions',
          attributes: ['id', 'content', 'options', 'explanation', 'concept', 'tags', 'difficulty'],
        }],
      });

      // Track AI generation
      analyticsService.trackAIGeneratedQuiz('daily-challenge', aiSuccess, aiFallbackUsed);
    }

    // Check if user has already completed today's challenge
    const userAttempt = await Attempt.findOne({
      where: {
        userId,
        quizId: dailyChallengeId,
      },
    });

    res.json({
      message: 'Daily challenge retrieved successfully',
      quiz: dailyChallenge,
      completed: !!userAttempt,
      userScore: userAttempt?.score || null,
    });
  } catch (error) {
    console.error('Error fetching daily challenge:', error);
    res.status(500).json({ message: 'Error fetching daily challenge', error: error.message });
  }
};

// Fallback question generator when AI fails
const generateFallbackQuestions = (subject, gradeLevel, count) => {
  const difficulties = ['easy', 'medium', 'hard'];
  const questions = [];
  for (let i = 0; i < count; i++) {
    questions.push({
      question: `Sample ${subject} question #${i + 1} for grade ${gradeLevel}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      explanation: 'This is a fallback explanation.',
      concept: subject,
      tags: [subject],
      difficulty: difficulties[Math.floor(Math.random() * difficulties.length)]
    });
  }
  return questions;
};

const submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body;
    const userId = req.user.id;
    const sessionId = req.session?.id;
    const isGuestSession = req.session?.type === 'guest';

    if (isGuestSession) {
      // For guest sessions, calculate score without database operations
      let correctAnswers = 0;
      const questionsWithPerformance = answers.map(a => ({
        difficulty: 'medium',
        isCorrect: Math.random() > 0.5 // Simulate random correctness for demo
      }));
      
      questionsWithPerformance.forEach(q => {
        if (q.isCorrect) correctAnswers++;
      });

      const score = (correctAnswers / answers.length) * 100;

      // Generate improvement tips using AI
      let improvementTips;
      try {
        const aiResponse = await aiService.generateImprovementTips(
          score,
          'General',
          [],
          []
        );
        improvementTips = aiResponse.suggestions.join('\n');
      } catch (error) {
        improvementTips = 'Continue practicing to improve your skills.';
      }

      const difficultyBreakdown = questionsWithPerformance.reduce((acc, q) => {
        if (!acc[q.difficulty]) acc[q.difficulty] = { total: 0, correct: 0 };
        acc[q.difficulty].total++;
        if (q.isCorrect) acc[q.difficulty].correct++;
        return acc;
      }, {});

      // Update session metadata with quiz results
      await sessionService.updateSessionMetadata(sessionId, {
        lastQuizScore: score,
        lastQuizSubject: 'General',
        weakAreas: [],
        strengths: [],
      });

      // Track quiz completed
      analyticsService.trackQuizCompleted(null, {
        subject: 'General',
        gradeLevel: null,
        totalQuestions: answers.length,
      }, correctAnswers);

      res.json({
        message: 'Quiz submitted successfully',
        score,
        improvementTips,
        correctAnswers,
        totalQuestions: answers.length,
        performanceBreakdown: {
          byDifficulty: difficultyBreakdown
        }
      });
    } else {
      const quiz = await Quiz.findOne({
        where: { id: quizId, userId },
        include: ['questions'],
      });

      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }

      // Process answers and calculate score
      let correctAnswers = 0;
      const questionsWithPerformance = [];
      
      await Promise.all(
        answers.map(async ({ questionId, answer }) => {
          const question = quiz.questions.find((q) => q.id === questionId);
          if (question) {
            const isCorrect = question.correctAnswer === answer;
            await question.update({
              userAnswer: answer,
              isCorrect,
            });
            if (isCorrect) correctAnswers++;
            questionsWithPerformance.push({
              difficulty: question.difficulty,
              isCorrect,
              concept: question.concept,
            });
          }
        })
      );

      const score = (correctAnswers / quiz.totalQuestions) * 100;

      // Use learning service to analyze attempt
      const analysis = learningService.analyzeAttempt(quiz, answers);
      const weakAreas = analysis.weakAreas;
      const strengths = analysis.strengths;
      const confidenceLevel = learningService.determineConfidenceLevel(score);
      const nextDifficulty = learningService.calculateNextDifficulty(
        quiz.difficulty,
        score,
        analysis.difficultyPerformance
      );

      // Get detailed improvement suggestions using AI
      let improvementTips;
      try {
        const aiResponse = await aiService.generateImprovementTips(
          score,
          quiz.subject,
          weakAreas,
          strengths
        );
        improvementTips = aiResponse.suggestions.join('\n');
      } catch (error) {
        improvementTips = `Focus on improving in: ${weakAreas.join(', ')}`;
      }

      // Generate next steps
      const nextSteps = learningService.generateNextSteps(score, weakAreas, strengths, quiz.subject);

      // Update quiz with performance data
      const difficultyBreakdown = questionsWithPerformance.reduce((acc, q) => {
        if (!acc[q.difficulty]) acc[q.difficulty] = { total: 0, correct: 0 };
        acc[q.difficulty].total++;
        if (q.isCorrect) acc[q.difficulty].correct++;
        return acc;
      }, {});

      await quiz.update({
        score,
        isCompleted: true,
        completedAt: new Date(),
        performanceData: {
          difficultyBreakdown,
          improvementTips
        }
      });

      // Create attempt record
      await Attempt.create({
        quizId,
        userId,
        sessionId,
        answers,
        score,
        weakAreas,
        strengths,
        confidenceLevel,
        nextSteps: {
          recommendedDifficulty: nextDifficulty,
          suggestions: nextSteps,
        },
      });

      // Track quiz completed
      analyticsService.trackQuizCompleted(userId, {
        id: quizId,
        subject: quiz.subject,
        gradeLevel: quiz.gradeLevel,
        totalQuestions: quiz.totalQuestions,
        sessionId,
      }, correctAnswers);

      res.json({
        message: 'Quiz submitted successfully',
        score,
        improvementTips,
        correctAnswers,
        totalQuestions: quiz.totalQuestions,
        weakAreas,
        strengths,
        confidenceLevel,
        performanceBreakdown: {
          byDifficulty: difficultyBreakdown
        }
      });
    }
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: 'Error submitting quiz', error: error.message });
  }
};

const getQuizHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = req.session?.id;
    const isGuestSession = req.session?.type === 'guest';

    if (isGuestSession) {
      // For guest sessions, return empty history (quizzes are not persisted)
      res.json([]);
      return;
    }

    const { grade, subject, minScore, maxScore, startDate, endDate } = req.query;

    const where = { userId };
    if (grade) where.gradeLevel = grade;
    if (subject) where.subject = subject;
    if (startDate && endDate) {
      where.completedAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }
    if (minScore) where.score = { [Op.gte]: minScore };
    if (maxScore) where.score = { ...where.score, [Op.lte]: maxScore };

    const quizzes = await Quiz.findAll({
      where,
      include: ['questions'],
      order: [['completedAt', 'DESC']],
    });

    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching quiz history:', error);
    res.status(500).json({ message: 'Error fetching quiz history', error: error.message });
  }
};

const getQuestionHint = async (req, res) => {
  try {
    const { questionId } = req.params;
    const isGuestSession = req.session?.type === 'guest';

    if (isGuestSession) {
      // For guest sessions, return a mock hint
      const hint = 'Consider the key concepts and principles behind this question.';
      res.json({ hint });
      return;
    }

    const question = await Question.findByPk(questionId);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Generate hint using AI service
    const hint = await aiService.generateHint(question.content);

    // Store hint for future use
    await question.update({ aiHint: hint });

    res.json({ hint });
  } catch (error) {
    console.error('Error generating hint:', error);
    res.status(500).json({ message: 'Error generating hint', error: error.message });
  }
};

const getQuestionExplanation = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { userAnswer } = req.body;
    const isGuestSession = req.session?.type === 'guest';

    const question = await Question.findByPk(questionId);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    let explanation;
    
    if (isGuestSession) {
      // For guest sessions, return a simple explanation
      explanation = `The correct answer is ${question.correctAnswer}. This answer demonstrates understanding of the key concepts in this question. Review the material related to this topic to strengthen your knowledge.`;
    } else {
      // Generate detailed explanation using AI service
      explanation = await aiService.generateExplanationWithRetry(
        question.content,
        question.correctAnswer,
        userAnswer || 'Not provided'
      );
      
      // Track AI hint generation
      analyticsService.trackAIGeneratedHint(req.user.id, true, false);
    }

    res.json({ explanation });
  } catch (error) {
    console.error('Error generating explanation:', error);
    
    // Track AI hint generation failure
    analyticsService.trackAIGeneratedHint(req.user.id, false, true);
    
    res.status(500).json({ message: 'Error generating explanation', error: error.message });
  }
};

const getLearningProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const isGuestSession = req.session?.type === 'guest';

    if (isGuestSession) {
      // For guest sessions, return minimal progress info
      return res.json({
        totalQuizzes: 0,
        avgScore: 0,
        weakAreas: [],
        strengths: [],
        trend: 'neutral',
        message: 'Sign up to track your learning progress',
      });
    }

    const progress = await learningService.getLearningProgress(userId);
    res.json(progress);
  } catch (error) {
    console.error('Error fetching learning progress:', error);
    res.status(500).json({ message: 'Error fetching learning progress', error: error.message });
  }
};

module.exports = {
  generateQuiz,
  generateRevisionQuiz,
  getDailyChallenge,
  submitQuiz,
  getQuizHistory,
  getQuestionHint,
  getQuestionExplanation,
  getLearningProgress,
};

const { Quiz, Question } = require('../models');
const { Op } = require('sequelize');

// Mock AI service for testing
const mockAIService = {
  generateQuestions: (subject, gradeLevel, count) => {
    const difficulties = ['easy', 'medium', 'hard'];
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        question: `Sample ${subject} question #${i + 1} for grade ${gradeLevel}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        difficulty: difficulties[Math.floor(Math.random() * difficulties.length)]
      });
    }
    return questions;
  },
  generateHint: (question) => {
    return `Here's a hint for the question: ${question}`;
  },
  generateImprovementTips: (score, subject, grade, questions) => {
    const tips = [];
    
    // Performance-based feedback
    if (score < 60) {
      tips.push(`Focus on building your fundamental ${subject} knowledge for grade ${grade}`);
      tips.push('Consider reviewing previous grade materials to strengthen basics');
    } else if (score < 80) {
      tips.push(`You're showing good progress in ${subject}. Keep practicing to improve further`);
      tips.push('Try solving problems with increasing difficulty levels');
    } else {
      tips.push(`Excellent work in ${subject}! Challenge yourself with advanced topics`);
      tips.push('Consider exploring grade ' + (grade + 1) + ' concepts');
    }

    // Analyze performance by difficulty level
    const difficultyPerformance = questions.reduce((acc, q) => {
      if (!acc[q.difficulty]) {
        acc[q.difficulty] = { total: 0, correct: 0 };
      }
      acc[q.difficulty].total++;
      if (q.isCorrect) acc[q.difficulty].correct++;
      return acc;
    }, {});

    // Add difficulty-specific tips
    Object.entries(difficultyPerformance).forEach(([difficulty, stats]) => {
      const successRate = (stats.correct / stats.total) * 100;
      if (successRate < 70) {
        tips.push(`Work on improving your performance on ${difficulty} difficulty questions`);
      }
    });

    return tips.join('\n');
  }
};

const generateQuiz = async (req, res) => {
  try {
    const { subject, gradeLevel, totalQuestions = 5 } = req.body;
    const userId = req.user.id;

    console.log('Generating quiz:', { subject, gradeLevel, totalQuestions, userId });

    // Generate questions using mock AI service
    const questions = mockAIService.generateQuestions(subject, gradeLevel, totalQuestions);

    // Create quiz
    const quiz = await Quiz.create({
      userId,
      subject,
      gradeLevel,
      difficulty: 'medium', // Default, will be adjusted based on user performance
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
          difficulty: q.difficulty,
        })
      )
    );

    // Load questions
    const quizWithQuestions = await Quiz.findByPk(quiz.id, {
      include: [{
        model: Question,
        as: 'questions',
        attributes: ['id', 'content', 'options', 'difficulty'],
      }],
    });

    res.status(201).json({
      message: 'Quiz generated successfully',
      quiz: quizWithQuestions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating quiz', error: error.message });
  }
};

const submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body;
    const userId = req.user.id;

    const quiz = await Quiz.findOne({
      where: { id: quizId, userId },
      include: ['questions'],
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Process answers and calculate score
    let correctAnswers = 0;
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
        }
      })
    );

    const score = (correctAnswers / quiz.totalQuestions) * 100;

    // Prepare questions with their performance data
    const questionsWithPerformance = quiz.questions.map(q => ({
      difficulty: q.difficulty,
      isCorrect: answers.find(a => a.questionId === q.id)?.answer === q.correctAnswer
    }));

    // Get detailed improvement suggestions
    const improvementTips = mockAIService.generateImprovementTips(
      score, 
      quiz.subject, 
      quiz.gradeLevel,
      questionsWithPerformance
    );

    // Update quiz with performance data
    const difficultyBreakdown = questionsWithPerformance.reduce((acc, q) => {
      if (!acc[q.difficulty]) acc[q.difficulty] = { total: 0, correct: 0 };
      acc[q.difficulty].total++;
      if (q.isCorrect) acc[q.difficulty].correct++;
      return acc;
    }, {});

    // Update quiz
    await quiz.update({
      score,
      isCompleted: true,
      completedAt: new Date(),
      performanceData: {
        difficultyBreakdown,
        improvementTips
      }
    });

    res.json({
      message: 'Quiz submitted successfully',
      score,
      improvementTips,
      correctAnswers,
      totalQuestions: quiz.totalQuestions,
      performanceBreakdown: {
        byDifficulty: difficultyBreakdown
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting quiz', error: error.message });
  }
};

const getQuizHistory = async (req, res) => {
  try {
    const userId = req.user.id;
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
    res.status(500).json({ message: 'Error fetching quiz history', error: error.message });
  }
};

const getQuestionHint = async (req, res) => {
  try {
    const { questionId } = req.params;
    const question = await Question.findByPk(questionId);

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Generate hint using Groq
    const completion = await groq.chat.completions.create({
      messages: [{
        role: 'user',
        content: `Provide a helpful hint for this question without giving away the answer: ${question.content}`,
      }],
      model: 'mixtral-8x7b-32768',
    });

    const hint = completion.choices[0].message.content;

    // Store hint for future use
    await question.update({ aiHint: hint });

    res.json({ hint });
  } catch (error) {
    res.status(500).json({ message: 'Error generating hint', error: error.message });
  }
};

module.exports = {
  generateQuiz,
  submitQuiz,
  getQuizHistory,
  getQuestionHint,
};

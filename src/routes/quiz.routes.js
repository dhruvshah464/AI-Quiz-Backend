const router = require('express').Router();
const quizController = require('../controllers/quiz.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply auth middleware to all quiz routes
router.use(authMiddleware);

router.post('/generate', quizController.generateQuiz);
router.post('/revision', quizController.generateRevisionQuiz);
router.get('/daily-challenge', quizController.getDailyChallenge);
router.post('/:quizId/submit', quizController.submitQuiz);
router.get('/history', quizController.getQuizHistory);
router.get('/question/:questionId/hint', quizController.getQuestionHint);
router.post('/question/:questionId/explain', quizController.getQuestionExplanation);
router.get('/progress', quizController.getLearningProgress);

module.exports = router;

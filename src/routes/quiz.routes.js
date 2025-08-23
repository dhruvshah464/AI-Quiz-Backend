const router = require('express').Router();
const quizController = require('../controllers/quiz.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply auth middleware to all quiz routes
router.use(authMiddleware);

router.post('/generate', quizController.generateQuiz);
router.post('/:quizId/submit', quizController.submitQuiz);
router.get('/history', quizController.getQuizHistory);
router.get('/question/:questionId/hint', quizController.getQuestionHint);

module.exports = router;

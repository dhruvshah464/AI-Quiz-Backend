const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');

router.post('/guest', sessionController.createGuestSession);
router.get('/:sessionId', sessionController.getSession);

module.exports = router;

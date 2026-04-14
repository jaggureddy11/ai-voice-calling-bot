const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');

// Trigger endpoint
router.post('/notify-journey', callController.notifyJourney);

// Voice Incoming Webhook Endpoint
router.post('/voice', callController.handleIncomingVoice);

module.exports = router;

const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');

// Passenger Management Endpoints
router.get('/passengers/:journeyId', callController.getPassengers);
router.post('/passengers', callController.addPassenger);

// Trigger endpoint
router.post('/notify-journey', callController.notifyJourney);

// Voice Incoming Webhook Endpoint (Initial trigger)
router.post('/voice', callController.handleIncomingVoice);

// Voice Callback Endpoint (When speech is gathered)
router.post('/voice/respond', callController.handleVoiceRespond);

module.exports = router;

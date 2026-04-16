const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');

const { validate, validateAll } = require('../middleware/validate');
const {
  passengerSchema,
  passengerQuerySchema,
  journeyTriggerParamsSchema,
  journeyTriggerBodySchema,
  twilioVoiceRespondSchema,
  twilioStatusCallbackSchema
} = require('../schemas');

// Passenger Management Endpoints
router.get(
  '/passengers/:journeyId', 
  validate(journeyTriggerParamsSchema, 'params'), 
  callController.getPassengers
);

router.post(
  '/passengers', 
  validate(passengerSchema), 
  callController.addPassenger
);

// Trigger endpoint
router.post(
  '/notify-journey', 
  validate(journeyTriggerBodySchema), 
  callController.notifyJourney
);

// Voice Incoming Webhook Endpoint (Initial trigger)
router.post('/voice', callController.handleIncomingVoice);

// Voice Callback Endpoint (When speech is gathered)
router.post(
  '/voice/respond', 
  validate(twilioVoiceRespondSchema), 
  callController.handleVoiceRespond
);

// Twilio Status Callback Endpoint
router.post(
  '/voice/status', 
  validate(twilioStatusCallbackSchema), 
  callController.handleVoiceStatus
);

// Telnyx / Exotel Webhook Endpoint
router.get('/exotel/voice', callController.handleExotelVoice);
router.post('/exotel/voice', callController.handleExotelVoice);

// SMS Fallback Endpoint



router.post('/sms-fallback', callController.sendSMSFallback);

// AI Interaction Logs Endpoint
router.get('/ai-logs', callController.getAILogs);

module.exports = router;


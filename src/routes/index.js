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

// Entity Discovery Endpoints
router.get('/operators', callController.getOperators);
router.get('/agencies', callController.getAgencies);
router.get('/buses', callController.getBuses);

// Passenger Management Endpoints
router.get(
  '/passengers/:busId', 
  callController.getPassengers
);

router.post(
  '/passengers', 
  validate(passengerSchema), 
  callController.addPassenger
);

router.patch(
  '/passengers/:passengerId/board', 
  callController.toggleBoardingStatus
);

// Trigger endpoint
router.post(
  '/notify-bus', 
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


/**
 * BoardPing — central schema registry
 *
 * Import everything from here so you never have to remember
 * which file a schema lives in.
 *
 * Usage:
 *   const { passengerSchema, twilioStatusCallbackSchema } = require('../schemas');
 */

const passenger = require('./passengerSchema');
const journey   = require('./journeySchema');
const call      = require('./callSchema');

module.exports = {
  // Passenger
  passengerSchema:        passenger.passengerSchema,
  bulkPassengerSchema:    passenger.bulkPassengerSchema,
  passengerQuerySchema:   passenger.passengerQuerySchema,

  // Journey
  journeySchema:                journey.journeySchema,
  journeyTriggerParamsSchema:   journey.journeyTriggerParamsSchema,
  journeyTriggerBodySchema:     journey.journeyTriggerBodySchema,
  journeyQuerySchema:           journey.journeyQuerySchema,

  // Calls / Twilio
  twilioStatusCallbackSchema:   call.twilioStatusCallbackSchema,
  twilioVoiceRespondSchema:     call.twilioVoiceRespondSchema,
  aiInteractionLogSchema:       call.aiInteractionLogSchema,
  callStatusUpdateParamsSchema: call.callStatusUpdateParamsSchema,
  callStatusUpdateBodySchema:   call.callStatusUpdateBodySchema,

  // Constants
  TWILIO_CALL_STATUSES: call.TWILIO_CALL_STATUSES,
  SUPPORTED_LANGUAGES:  passenger.SUPPORTED_LANGUAGES,
  INTENT_VALUES:        call.INTENT_VALUES,
  SENTIMENT_VALUES:     call.SENTIMENT_VALUES,
};

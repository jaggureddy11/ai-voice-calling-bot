const { z } = require('zod');

// ---------------------------------------------------------------------------
// Twilio call status callback
// POST /api/calls/status
//
// Twilio sends this as application/x-www-form-urlencoded.
// Express must have express.urlencoded() middleware enabled.
// ---------------------------------------------------------------------------

const TWILIO_CALL_STATUSES = [
  'queued',
  'ringing',
  'in-progress',
  'canceled',
  'completed',
  'busy',
  'no-answer',
  'failed',
];

const twilioStatusCallbackSchema = z.object({
  CallSid: z
    .string({ required_error: 'CallSid is required' })
    .regex(/^CA[a-f0-9]{32}$/, 'Invalid Twilio CallSid format'),

  CallStatus: z.enum(TWILIO_CALL_STATUSES, {
    errorMap: () => ({
      message: `CallStatus must be one of: ${TWILIO_CALL_STATUSES.join(', ')}`,
    }),
  }),

  From: z.string().optional(),
  To: z.string().optional(),

  // Duration is only present on completed calls
  CallDuration: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : undefined))
    .refine((v) => v === undefined || (!isNaN(v) && v >= 0), {
      message: 'CallDuration must be a non-negative number',
    }),

  // Twilio account the call belongs to
  AccountSid: z
    .string()
    .regex(/^AC[a-f0-9]{32}$/, 'Invalid Twilio AccountSid format')
    .optional(),

  Direction: z.enum(['inbound', 'outbound-api', 'outbound-dial']).optional(),
});

// ---------------------------------------------------------------------------
// Twilio voice webhook — passenger speech input
// POST /api/calls/voice/respond
//
// This is what Twilio sends after a <Gather> block completes.
// SpeechResult contains the transcribed passenger speech.
// ---------------------------------------------------------------------------

const twilioVoiceRespondSchema = z.object({
  CallSid: z
    .string({ required_error: 'CallSid is required' })
    .regex(/^CA[a-f0-9]{32}$/, 'Invalid Twilio CallSid format'),

  // Present when <Gather input="speech"> is used
  SpeechResult: z
    .string()
    .trim()
    .max(1000, 'Speech result exceeds maximum length')
    .optional()
    .default(''),

  // Confidence score from Twilio's ASR (0.0–1.0 as string)
  Confidence: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseFloat(v) : undefined))
    .refine((v) => v === undefined || (!isNaN(v) && v >= 0 && v <= 1), {
      message: 'Confidence must be between 0 and 1',
    }),

  // Present when <Gather input="dtmf"> is used (keypad input)
  Digits: z
    .string()
    .regex(/^[\d#*]{0,20}$/, 'Digits must only contain 0–9, #, or *')
    .optional(),

  CallStatus: z.enum(TWILIO_CALL_STATUSES).optional(),

  From: z.string().optional(),
  To: z.string().optional(),
});

// ---------------------------------------------------------------------------
// AI interaction log — internal endpoint
// POST /api/calls/log
//
// Called by callController to persist conversation turns to Supabase.
// ---------------------------------------------------------------------------

const SENTIMENT_VALUES = ['positive', 'neutral', 'negative', 'urgent', 'unknown'];
const INTENT_VALUES    = ['ACKNOWLEDGED', 'LATE', 'CANCEL', 'QUESTION', 'UNKNOWN'];

const aiInteractionLogSchema = z.object({
  call_sid: z
    .string({ required_error: 'CallSid is required' })
    .regex(/^CA[a-f0-9]{32}$/, 'Invalid Twilio CallSid format'),

  passenger_id: z
    .string()
    .optional(),

  passenger_name: z.string().trim().max(100).optional(),

  user_speech: z
    .string()
    .trim()
    .max(1000, 'User speech must not exceed 1000 characters')
    .default(''),

  bot_response: z
    .string({ required_error: 'Bot response is required' })
    .trim()
    .min(1, 'Bot response cannot be empty')
    .max(2000, 'Bot response must not exceed 2000 characters'),

  intent_detected: z.enum(INTENT_VALUES).default('UNKNOWN'),

  sentiment: z.enum(SENTIMENT_VALUES).default('unknown'),

  // Groq inference latency in milliseconds — useful for monitoring
  latency_ms: z
    .number()
    .int()
    .min(0)
    .max(30000)
    .optional(),

  journey_id: z
    .string()
    .optional(),
});

// ---------------------------------------------------------------------------
// Call status update — internal
// PATCH /api/calls/:callSid/status
//
// Used by workers to sync call state back from Twilio into Supabase.
// ---------------------------------------------------------------------------

const callStatusUpdateParamsSchema = z.object({
  callSid: z
    .string({ required_error: 'callSid is required' })
    .regex(/^CA[a-f0-9]{32}$/, 'Invalid Twilio CallSid format'),
});

const callStatusUpdateBodySchema = z.object({
  status: z.enum(TWILIO_CALL_STATUSES, {
    errorMap: () => ({
      message: `Status must be one of: ${TWILIO_CALL_STATUSES.join(', ')}`,
    }),
  }),

  duration_seconds: z
    .number()
    .int()
    .min(0)
    .optional(),

  attempts: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional(),

  error_code: z
    .string()
    .max(20)
    .optional(),

  error_message: z
    .string()
    .max(500)
    .optional(),
});

module.exports = {
  twilioStatusCallbackSchema,
  twilioVoiceRespondSchema,
  aiInteractionLogSchema,
  callStatusUpdateParamsSchema,
  callStatusUpdateBodySchema,
  TWILIO_CALL_STATUSES,
  SENTIMENT_VALUES,
  INTENT_VALUES,
};

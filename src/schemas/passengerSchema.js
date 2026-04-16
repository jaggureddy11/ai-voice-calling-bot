const { z } = require('zod');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates and normalises an Indian mobile number.
 *
 * Accepts:
 *   9876543210      (10 digits, no prefix)
 *   +919876543210   (E.164 with +91)
 *   919876543210    (E.164 without +)
 *   09876543210     (with leading 0)
 *
 * Always outputs E.164 format: +91XXXXXXXXXX
 */
const indianPhoneSchema = z
  .string({ required_error: 'Phone number is required' })
  .trim()
  .transform((val) => {
    // Strip spaces, dashes, dots
    const stripped = val.replace(/[\s\-\.]/g, '');

    if (/^\+91[6-9]\d{9}$/.test(stripped)) return stripped;
    if (/^91[6-9]\d{9}$/.test(stripped))   return `+${stripped}`;
    if (/^0[6-9]\d{9}$/.test(stripped))    return `+91${stripped.slice(1)}`;
    if (/^[6-9]\d{9}$/.test(stripped))     return `+91${stripped}`;

    return stripped; // pass through so the refine below can reject it
  })
  .refine(
    (val) => /^\+91[6-9]\d{9}$/.test(val),
    { message: 'Must be a valid 10-digit Indian mobile number (starts with 6–9)' }
  );

/**
 * Supported Indian languages for TTS.
 * Extend this list as you add Sarvam AI voices.
 */
const SUPPORTED_LANGUAGES = [
  'en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or',
] ;

const languageSchema = z
  .string()
  .transform((val) => val.toLowerCase())
  .refine((val) => {
    const base = val.split('-')[0];
    return SUPPORTED_LANGUAGES.includes(base) || SUPPORTED_LANGUAGES.includes(val);
  }, {
    message: `Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
  });


// ---------------------------------------------------------------------------
// Single passenger ingestion
// POST /api/calls/passengers
// ---------------------------------------------------------------------------

const passengerSchema = z.object({
  name: z
    .string({ required_error: 'Passenger name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-Z\u0900-\u097F\s'.,-]+$/, {
      message: 'Name contains invalid characters',
    }),

  phone: indianPhoneSchema,

  journey_id: z
    .string({ required_error: 'Journey ID is required' })
    // In our existing app, journey_id is often a string like 'VRL-123-DYN', not always a UUID.
    // However, the provided schemas use UUID. Let's see if we should relax it.
    // The existing app's app.js uses: `document.getElementById('trip-id').value = `${op}-${Math.floor(Math.random() * 900) + 100}-DYN`;`
    // So it's NOT a UUID.
    .min(3, 'Journey ID must be at least 3 characters'),

  boarding_point: z
    .string({ required_error: 'Boarding point is required' })
    .trim()
    .min(2, 'Boarding point must be at least 2 characters')
    .max(200, 'Boarding point must not exceed 200 characters'),

  seat_number: z
    .string()
    .trim()
    .max(10, 'Seat number must not exceed 10 characters')
    .optional(),

  language: languageSchema.default('en'),

  time: z.string().optional(),

  pnr: z

    .string()
    .trim()
    .max(20, 'PNR must not exceed 20 characters')
    .optional(),
});

// ---------------------------------------------------------------------------
// Bulk passenger ingestion
// POST /api/calls/passengers/bulk
// ---------------------------------------------------------------------------

const bulkPassengerSchema = z.object({
  journey_id: z
    .string({ required_error: 'Journey ID is required' })
    .min(3, 'Journey ID must be at least 3 characters'),

  passengers: z
    .array(
      z.object({
        name: z
          .string({ required_error: 'Passenger name is required' })
          .trim()
          .min(2)
          .max(100),
        phone: indianPhoneSchema,
        boarding_point: z.string().trim().min(2).max(200),
        seat_number: z.string().trim().max(10).optional(),
        language: languageSchema.default('en'),
        pnr: z.string().trim().max(20).optional(),
      })
    )
    .min(1, 'At least one passenger is required')
    .max(500, 'Cannot ingest more than 500 passengers at once'),
});

// ---------------------------------------------------------------------------
// Passenger list query params
// GET /api/calls/passengers?journey_id=...&status=...
// ---------------------------------------------------------------------------

const passengerQuerySchema = z.object({
  journey_id: z.string().min(3).optional(),

  status: z
    .enum(['pending', 'initiated', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy'])
    .optional(),

  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 50))
    .refine((v) => !isNaN(v) && v >= 1 && v <= 200, {
      message: 'Limit must be between 1 and 200',
    }),

  offset: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 0))
    .refine((v) => !isNaN(v) && v >= 0, {
      message: 'Offset must be 0 or greater',
    }),
});

module.exports = {
  passengerSchema,
  bulkPassengerSchema,
  passengerQuerySchema,
  indianPhoneSchema,
  languageSchema,
  SUPPORTED_LANGUAGES,
};

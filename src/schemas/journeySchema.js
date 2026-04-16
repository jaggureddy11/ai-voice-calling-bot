const { z } = require('zod');

// ---------------------------------------------------------------------------
// Journey creation
// POST /api/journeys
// ---------------------------------------------------------------------------

const journeySchema = z.object({
  operator_name: z
    .string({ required_error: 'Operator name is required' })
    .trim()
    .min(2, 'Operator name must be at least 2 characters')
    .max(100, 'Operator name must not exceed 100 characters'),

  route: z
    .string({ required_error: 'Route is required' })
    .trim()
    .min(3, 'Route must be at least 3 characters')
    .max(200, 'Route must not exceed 200 characters'),

  departure_time: z
    .string({ required_error: 'Departure time is required' })
    // Simple regex or similar if not ISO 8601. In app.js it's "22:00" sometimes.
    // In src/app.js/controllers/callController.js: departure_time: time
    // Let's allow strings of reasonable length.
    .min(4, 'Departure time is required'),

  boarding_point: z
    .string({ required_error: 'Boarding point is required' })
    .trim()
    .min(2)
    .max(200),

  bus_number: z
    .string()
    .trim()
    .max(20, 'Bus number must not exceed 20 characters')
    .optional(),

  notify_before_minutes: z
    .number()
    .int()
    .min(5, 'Notification must be at least 5 minutes before departure')
    .max(120, 'Notification must be at most 120 minutes before departure')
    .default(30),
});

// ---------------------------------------------------------------------------
// Journey trigger — params only
// POST /api/calls/notify/:journeyId
// ---------------------------------------------------------------------------

const journeyTriggerParamsSchema = z.object({
  busId: z
    .string({ required_error: 'Bus ID is required' })
    .min(3, 'Bus ID is too short'),
});

// ---------------------------------------------------------------------------
// Journey trigger — optional body overrides
// POST /api/calls/notify/:journeyId  { message_override, force }
// ---------------------------------------------------------------------------

const journeyTriggerBodySchema = z
  .object({
    busId: z.string({ required_error: 'busId is required' }).min(3),
    
    // Lets an operator override the auto-generated message for one specific blast
    message_override: z
      .string()
      .trim()
      .min(10, 'Message override must be at least 10 characters')
      .max(500, 'Message override must not exceed 500 characters')
      .optional(),

    // Force re-notify even if passengers were already called
    force: z.boolean().default(false),

    // Limit call blast to specific seat numbers
    seat_numbers: z
      .array(z.string().trim().max(10))
      .max(200, 'Cannot target more than 200 specific seats')
      .optional(),
  })
  .optional()
  .default({});


// ---------------------------------------------------------------------------
// Journey query params
// GET /api/journeys?operator=...&date=...
// ---------------------------------------------------------------------------

const journeyQuerySchema = z.object({
  operator_name: z.string().trim().max(100).optional(),

  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),

  status: z
    .enum(['scheduled', 'notifying', 'completed', 'cancelled'])
    .optional(),

  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
    .refine((v) => !isNaN(v) && v >= 1 && v <= 100, {
      message: 'Limit must be between 1 and 100',
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
  journeySchema,
  journeyTriggerParamsSchema,
  journeyTriggerBodySchema,
  journeyQuerySchema,
};

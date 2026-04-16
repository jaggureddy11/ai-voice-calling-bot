const { ZodError } = require('zod');

/**
 * Validation middleware factory for BoardPing.
 *
 * Usage:
 *   router.post('/passengers', validate(passengerSchema), controller)
 *   router.post('/notify/:id', validate(journeyTriggerSchema, 'params'), controller)
 *
 * @param {import('zod').ZodSchema} schema  - Zod schema to validate against
 * @param {'body'|'params'|'query'} source  - Which part of the request to validate
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    // Replace req[source] with the parsed + coerced data so downstream
    // controllers always receive clean, typed values (e.g. trimmed strings,
    // normalised phone numbers).
    req[source] = result.data;
    next();
  };
};

/**
 * Formats a ZodError into a flat, human-readable array of field errors.
 * Keeps error messages useful for both operators and API consumers.
 *
 * @param {ZodError} error
 * @returns {{ field: string, message: string }[]}
 */
const formatZodErrors = (error) => {
  return error.errors.map((err) => ({
    field: err.path.join('.') || 'root',
    message: err.message,
  }));
};

/**
 * Validates multiple sources in a single middleware.
 * Use when a route needs both params AND body validated (e.g. PATCH /journeys/:id).
 *
 * @param {{ body?: ZodSchema, params?: ZodSchema, query?: ZodSchema }} schemas
 */
const validateAll = (schemas) => {
  return (req, res, next) => {
    const allErrors = [];

    for (const [source, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        const errors = formatZodErrors(result.error).map((e) => ({
          ...e,
          source,
        }));
        allErrors.push(...errors);
      } else {
        req[source] = result.data;
      }
    }

    if (allErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: allErrors,
      });
    }

    next();
  };
};

module.exports = { validate, validateAll };

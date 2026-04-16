/**
 * BoardPing validation tests
 * Run with: node tests/validation.test.js
 * (No test framework needed — pure Node.js assertions)
 */

const assert = require('assert');

const {
  passengerSchema,
  bulkPassengerSchema,
  passengerQuerySchema,
  journeySchema,
  journeyTriggerParamsSchema,
  journeyTriggerBodySchema,
  twilioStatusCallbackSchema,
  twilioVoiceRespondSchema,
  callStatusUpdateBodySchema,
} = require('../src/schemas');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function expectValid(schema, data) {
  const result = schema.safeParse(data);
  assert.ok(result.success, `Expected valid, got: ${JSON.stringify(result.error?.errors)}`);
  return result.data;
}

function expectInvalid(schema, data, expectedField) {
  const result = schema.safeParse(data);
  assert.ok(!result.success, `Expected invalid but got success for: ${JSON.stringify(data)}`);
  if (expectedField) {
    // Zod 3 uses .errors (array of ZodIssue); each issue has a .path array
    const issues = result.error?.errors || result.error?.issues || [];
    const fields = issues.map((e) => e.path.join('.'));
    assert.ok(
      fields.some((f) => f === expectedField || f.startsWith(expectedField)),
      `Expected error on field '${expectedField}', got errors on: ${fields.join(', ') || '(root)'}`
    );
  }
  return result.error;
}

// ===========================================================================
// PASSENGER SCHEMA
// ===========================================================================
console.log('\nPassenger schema');

test('accepts valid passenger with all fields', () => {
  const data = expectValid(passengerSchema, {
    name: 'Rahul Sharma',
    phone: '9876543210',
    journey_id: 'VRL-123-DYN',
    boarding_point: 'Majestic Bus Stand, Bangalore',
    language: 'hi',
    seat_number: 'A12',
    pnr: 'RB1234567',
  });
  assert.strictEqual(data.phone, '+919876543210', 'Phone should be normalised to E.164');
  assert.strictEqual(data.language, 'hi');
});

test('normalises +91 prefix phone', () => {
  const data = expectValid(passengerSchema, {
    name: 'Test User',
    phone: '+919876543210',
    journey_id: 'VRL-123-DYN',
    boarding_point: 'Chennai Central',
  });
  assert.strictEqual(data.phone, '+919876543210');
});

test('normalises 91-prefix without +', () => {
  const data = expectValid(passengerSchema, {
    name: 'Test User',
    phone: '919876543210',
    journey_id: 'VRL-123-DYN',
    boarding_point: 'Chennai Central',
  });
  assert.strictEqual(data.phone, '+919876543210');
});

test('normalises 0-prefix phone', () => {
  const data = expectValid(passengerSchema, {
    name: 'Test User',
    phone: '09876543210',
    journey_id: 'VRL-123-DYN',
    boarding_point: 'Chennai Central',
  });
  assert.strictEqual(data.phone, '+919876543210');
});

test('defaults language to en when omitted', () => {
  const data = expectValid(passengerSchema, {
    name: 'Test User',
    phone: '9876543210',
    journey_id: 'VRL-123-DYN',
    boarding_point: 'Chennai Central',
  });
  assert.strictEqual(data.language, 'en');
});

test('rejects phone starting with 1–5', () => {
  expectInvalid(passengerSchema, {
    name: 'Test User',
    phone: '1234567890',
    journey_id: 'VRL-123-DYN',
    boarding_point: 'Chennai Central',
  }, 'phone');
});

test('rejects 9-digit phone', () => {
  expectInvalid(passengerSchema, {
    name: 'Test User',
    phone: '987654321',
    journey_id: 'VRL-123-DYN',
    boarding_point: 'Chennai Central',
  }, 'phone');
});

test('rejects unsupported language', () => {
  expectInvalid(passengerSchema, {
    name: 'Test User',
    phone: '9876543210',
    journey_id: 'VRL-123-DYN',
    boarding_point: 'Chennai Central',
    language: 'zz',
  }, 'language');
});

test('rejects name too short', () => {
  expectInvalid(passengerSchema, {
    name: 'A',
    phone: '9876543210',
    journey_id: 'VRL-123-DYN',
    boarding_point: 'Chennai Central',
  }, 'name');
});

// ===========================================================================
// BULK PASSENGER SCHEMA
// ===========================================================================
console.log('\nBulk passenger schema');

test('accepts valid bulk payload', () => {
  const data = expectValid(bulkPassengerSchema, {
    journey_id: 'VRL-123-DYN',
    passengers: [
      { name: 'Rahul Sharma', phone: '9876543210', boarding_point: 'Majestic' },
      { name: 'Priya Iyer',   phone: '8765432109', boarding_point: 'Silk Board' },
    ],
  });
  assert.strictEqual(data.passengers.length, 2);
  assert.strictEqual(data.passengers[0].phone, '+919876543210');
});

test('rejects empty passengers array', () => {
  expectInvalid(bulkPassengerSchema, {
    journey_id: 'VRL-123-DYN',
    passengers: [],
  }, 'passengers');
});

// ===========================================================================
// JOURNEY SCHEMA
// ===========================================================================
console.log('\nJourney schema');

test('accepts valid journey', () => {
  const data = expectValid(journeySchema, {
    operator_name: 'VRL Travels',
    route: 'Bangalore → Mysore',
    departure_time: '22:00',
    boarding_point: 'Majestic Bus Stand',
  });
  assert.strictEqual(data.notify_before_minutes, 30, 'Should default to 30 minutes');
});

// ===========================================================================
// JOURNEY TRIGGER PARAMS
// ===========================================================================
console.log('\nJourney trigger params');

test('accepts valid ID param', () => {
  expectValid(journeyTriggerParamsSchema, {
    journeyId: 'VRL-123-DYN',
  });
});

test('rejects too short param', () => {
  expectInvalid(journeyTriggerParamsSchema, {
    journeyId: 'j-',
  }, 'journeyId');
});

// ===========================================================================
// TWILIO WEBHOOKS
// ===========================================================================
console.log('\nTwilio webhook schemas');

test('accepts valid status callback', () => {
  const data = expectValid(twilioStatusCallbackSchema, {
    CallSid: 'CA' + 'a'.repeat(32),
    CallStatus: 'completed',
    CallDuration: '45',
    AccountSid: 'AC' + 'b'.repeat(32),
  });
  assert.strictEqual(data.CallDuration, 45, 'Duration should be parsed to number');
});

test('rejects invalid CallSid format', () => {
  expectInvalid(twilioStatusCallbackSchema, {
    CallSid: 'invalid-sid',
    CallStatus: 'completed',
  }, 'CallSid');
});

test('rejects unknown CallStatus', () => {
  expectInvalid(twilioStatusCallbackSchema, {
    CallSid: 'CA' + 'a'.repeat(32),
    CallStatus: 'unknown-status',
  }, 'CallStatus');
});

test('accepts voice respond with speech', () => {
  const data = expectValid(twilioVoiceRespondSchema, {
    CallSid: 'CA' + 'a'.repeat(32),
    SpeechResult: 'I am on my way, 5 minutes away',
    Confidence: '0.92',
  });
  assert.strictEqual(data.Confidence, 0.92);
});

test('defaults SpeechResult to empty string when missing', () => {
  const data = expectValid(twilioVoiceRespondSchema, {
    CallSid: 'CA' + 'a'.repeat(32),
  });
  assert.strictEqual(data.SpeechResult, '');
});

// ===========================================================================
// CALL STATUS UPDATE
// ===========================================================================
console.log('\nCall status update schema');

test('accepts valid status update', () => {
  expectValid(callStatusUpdateBodySchema, {
    status: 'completed',
    duration_seconds: 42,
    attempts: 1,
  });
});

test('rejects invalid status value', () => {
  expectInvalid(callStatusUpdateBodySchema, {
    status: 'delivered', // not a Twilio status
  }, 'status');
});

// ===========================================================================
// RESULTS
// ===========================================================================
console.log(`\n${'─'.repeat(40)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log(`${'─'.repeat(40)}\n`);

if (failed > 0) process.exit(1);

const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const twilioClient = require('../config/twilio');

// Worker to process 'callNotifications' jobs
const worker = new Worker('callNotifications', async job => {
  const { name, phone, boardingPoint, time, language } = job.data;
  
  console.log(`[Job ${job.id}] Processing call to ${name} (${phone})...`);

  // Simple Twilio string interpolation using TwiML
  // For MVP, we use English/Hindi simple TTS
  let message = `Namaste ${name}, your bus to ${boardingPoint} is departing at ${time}. Please reach the boarding point 15 minutes early.`;
  
  if(language === 'hi-IN') {
     message = `Namaste ${name}, aapki bus ${boardingPoint} se ${time} par ravaana hogi. Kripya pandra minute pehle pahunch jaayein.`;
  }

  // TwiML allows generating speech via Twilio TTS engine
  const twimlObj = new twilioClient.twiml.VoiceResponse();
  twimlObj.say({ voice: 'Polly.Aditi', language }, message);

  try {
    const call = await twilioClient.calls.create({
      twiml: twimlObj.toString(),
      to: phone,
      from: process.env.TWILIO_FROM_NUMBER
    });
    console.log(`[Job ${job.id}] Call triggered successfully! Call SID: ${call.sid}`);
    return call.sid;
  } catch (error) {
    console.error(`[Job ${job.id}] Failed to trigger call: ${error.message}`);
    throw error; // Let BullMQ handle the retry
  }
}, { connection });

worker.on('completed', (job) => {
  console.log(`Job with id ${job.id} has been completed`);
});

worker.on('failed', (job, err) => {
  console.log(`Job with id ${job.id} has failed with ${err.message}`);
});

module.exports = worker;

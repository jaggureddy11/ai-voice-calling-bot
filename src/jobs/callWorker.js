const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const twilioClient = require('../config/twilio');
const supabase = require('../config/supabase');

// Worker to process 'callNotifications' jobs
const worker = new Worker('callNotifications', async job => {
  // We use boarding_point to match the Supabase SQL column 
  const { name, phone, boarding_point, time, language, callLogId } = job.data;
  
  console.log(`[Job ${job.id}] Processing call to ${name} (${phone})...`);

  // Simple Twilio string interpolation using TwiML
  let message = `Namaste ${name}, your bus to ${boarding_point} is departing at ${time}. Please reach the boarding point 15 minutes early.`;
  
  if(language === 'hi-IN') {
     message = `Namaste ${name}, aapki bus ${boarding_point} se ${time} par ravaana hogi. Kripya pandra minute pehle pahunch jaayein.`;
  }

  const twimlObj = new twilioClient.twiml.VoiceResponse();
  twimlObj.say({ voice: 'Polly.Aditi', language: language || 'en-IN' }, message);

  try {
    const call = await twilioClient.calls.create({
      twiml: twimlObj.toString(),
      to: phone,
      from: process.env.TWILIO_FROM_NUMBER
    });
    
    console.log(`[Job ${job.id}] Call triggered successfully! Call SID: ${call.sid}`);
    
    // Update Supabase Call Log
    if (callLogId) {
      await supabase
        .from('call_logs')
        .update({ status: 'completed', twilio_sid: call.sid })
        .eq('id', callLogId);
    }

    return call.sid;
  } catch (error) {
    console.error(`[Job ${job.id}] Failed to trigger call: ${error.message}`);
    
    // Update Supabase Call Log on Failure
    if (callLogId) {
      await supabase
        .from('call_logs')
        .update({ status: 'failed' })
        .eq('id', callLogId);
    }

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

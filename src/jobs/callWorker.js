const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const twilioClient = require('../config/twilio');
const supabase = require('../config/supabase');

// Worker to process 'callNotifications' jobs
const worker = new Worker('callNotifications', async job => {
  try {
    // We use boarding_point to match the Supabase SQL column 
    const { name, phone, boarding_point, time, language, callLogId } = job.data;
    
    console.log(`[Job ${job.id}] Processing call to ${name} (${phone})...`);

    // Simple Twilio string interpolation using TwiML
    let message = `Namaste ${name}, your bus to ${boarding_point} is departing at ${time}. Please reach the boarding point 15 minutes early.`;
    
    if(language === 'hi-IN') {
       message = `Namaste ${name}, aapki bus ${boarding_point} se ${time} par ravaana hogi. Kripya pandra minute pehle pahunch jaayein.`;
    } else if(language === 'te-IN') {
       message = `Namaste ${name}, mee bus ${boarding_point} nundi ${time} ki bayaluderutundi. Dayachesi padmudu nimmishalu mundu cherukondi.`;
    } else if(language === 'kn-IN') {
       message = `Namaste ${name}, nimma bus ${boarding_point} ninda ${time} gantege horaduttade. Dayavittu hadinaidu nimisha mundagi banni.`;
    }

    const twimlObj = new twilioClient.twiml.VoiceResponse();
    
    // NEW: Use Premium HF Voice for Initial Greeting
    const { generateSpeech } = require('../services/hfService');
    const hfUrl = await generateSpeech(message);
    console.log(`[Worker HF Debug] Generated URL: ${hfUrl}`);


    // Make the call conversational by adding a Gather block
    const gather = twimlObj.gather({
      input: 'speech',
      action: `/api/calls/voice/respond?callLogId=${callLogId}`,
      speechTimeout: 'auto',
      language: language || 'en-IN'
    });

    if (hfUrl) {
      gather.play(hfUrl);
    } else {
      gather.say({ voice: 'Polly.Aditi', language: language || 'en-IN' }, message);
    }


    // Update Supabase with attempt count increment
    if (callLogId) {
       await supabase.rpc('increment_attempt', { log_id: callLogId });
    }

    const call = await twilioClient.calls.create({
      twiml: twimlObj.toString(),
      to: phone,
      from: process.env.TWILIO_FROM_NUMBER,
      statusCallback: `${process.env.BASE_URL}/api/calls/voice/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });
    
    console.log(`[Job ${job.id}] Call triggered successfully! Call SID: ${call.sid}`);
    
    // Update Supabase Call Log with SID and initial status
    if (callLogId) {
      await supabase
        .from('call_logs')
        .update({ status: 'initiated', twilio_sid: call.sid })
        .eq('id', callLogId);
    }

    return call.sid;
  } catch (error) {
    console.error(`[Job ${job.id}] Failed to trigger call: ${error.message}`);
    
    // Update Supabase Call Log on Failure
    if (job.data.callLogId) {
      await supabase
        .from('call_logs')
        .update({ status: 'failed' })
        .eq('id', job.data.callLogId);
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

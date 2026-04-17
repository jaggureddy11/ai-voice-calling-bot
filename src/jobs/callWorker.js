const { Worker } = require('bullmq');
const { connection } = require('../config/redis');
const supabase = require('../config/supabase');

// Worker to process 'callNotifications' jobs
const worker = new Worker('callNotifications', async job => {
  try {
    // We use boarding_point to match the Supabase SQL column 
    const { name, phone, boarding_point, time, language, callLogId } = job.data;
    
    console.log(`[Job ${job.id}] Processing call to ${name} (${phone})...`);

    // Update Supabase with attempt count increment manually instead of RCP to prevent crash
    if (callLogId) {
       const { data: currentLog } = await supabase.from('call_logs').select('attempt_count').eq('id', callLogId).single();
       if (currentLog) {
         await supabase.from('call_logs').update({ attempt_count: (currentLog.attempt_count || 0) + 1 }).eq('id', callLogId);
       }
    }

    const { createCall } = require('../services/exotelService');
    const exotelSid = await createCall(phone, callLogId);
    
    console.log(`[Job ${job.id}] Exotel Call triggered successfully! SID: ${exotelSid}`);
    
    // Update Supabase Call Log with SID and initial status
    if (callLogId) {
      await supabase
        .from('call_logs')
        .update({ status: 'initiated', twilio_sid: exotelSid }) // Using same column twilio_sid to hold external platform SID
        .eq('id', callLogId);
    }

    return exotelSid;
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

const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

// Create a new BullMQ queue specifically for sending calls
const callQueue = new Queue('callNotifications', { connection });

async function addCallToQueue(passengerInfo) {
  // Adding job to queue. The passenger info is the payload.
  // We can also configure priorities, delays, or attempts here.
  return await callQueue.add('passengerCall', passengerInfo, {
    attempts: 3, // retry 3 times on failure
    backoff: {
      type: 'exponential',
      delay: 5000 // wait 5 seconds before retrying
    }
  });
}

module.exports = { callQueue, addCallToQueue };

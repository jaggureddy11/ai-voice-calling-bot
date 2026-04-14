require('dotenv').config();
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function makeCall() {
  try {
    const call = await client.calls.create({
      // We pass your ngrok voice URL here. 
      // When you answer the phone, Twilio hits this URL to get the AI greeting and starts the talk loop!
      url: 'https://isolation-credibly-reflected.ngrok-free.dev/api/calls/voice',

      // REPLACE THIS with your actual mobile number (Include +91 for India)
      to: '+919110300509',

      from: process.env.TWILIO_FROM_NUMBER
    });
    console.log(`Call triggered successfully! SID: ${call.sid}`);
    console.log('Your phone should ring in a few seconds...');
  } catch (error) {
    console.error('\n🚨 Failed to trigger call. Make sure your personal phone number is added to Twilio Verified Caller IDs!\n');
    console.error(error);
  }
}

makeCall();

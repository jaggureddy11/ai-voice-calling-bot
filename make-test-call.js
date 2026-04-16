require('dotenv').config();
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function makeCall() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  
  try {
    const call = await client.calls.create({
      // We use the voice URL from environment to support ngrok/local tunnels dynamically
      url: `${baseUrl}/api/calls/voice`,

      // REPLACE THIS with your actual mobile number (Include +91 for India)
      to: '+919110300509',

      from: process.env.TWILIO_FROM_NUMBER
    });
    console.log(`Call triggered successfully! SID: ${call.sid}`);
    console.log(`Twilio will callback to: ${baseUrl}/api/calls/voice`);
  } catch (error) {
    console.error('\n🚨 Failed to trigger call. Make sure your personal phone number is added to Twilio Verified Caller IDs!\n');
    console.error(error);
  }
}

makeCall();


const axios = require('axios');

/**
 * SMS Service
 * Handles fallback notifications via Exotel or Twilio.
 */
const sendSMS = async (to, message) => {
  const { EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SUBDOMAIN, EXOTEL_CALLER_ID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

  console.log(`[SMS Service]: Attempting to send message to ${to}...`);

  // Try Exotel (Preferred for India)
  if (EXOTEL_SID && EXOTEL_API_KEY) {
    try {
      const url = `https://${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}@${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_SID}/Sms/send.json`;
      const response = await axios.post(url, new URLSearchParams({
        From: EXOTEL_CALLER_ID,
        To: to,
        Body: message
      }).toString());

      console.log(`[SMS Success]: Exotel SID ${response.data.SmsMessage.Sid}`);
      return { platform: 'exotel', sid: response.data.SmsMessage.Sid };
    } catch (error) {
      console.warn(`[SMS Warning]: Exotel failed, trying Twilio fallback. Error: ${error.message}`);
    }
  }

  // Fallback to Twilio
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    try {
      const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      const response = await client.messages.create({
        body: message,
        from: TWILIO_FROM_NUMBER,
        to: to
      });

      console.log(`[SMS Success]: Twilio SID ${response.sid}`);
      return { platform: 'twilio', sid: response.sid };
    } catch (error) {
      console.error(`[SMS Error]: Both platforms failed to send SMS to ${to}. Error: ${error.message}`);
      throw error;
    }
  }

  throw new Error('No SMS provider credentials found in environment.');
};

module.exports = { sendSMS };

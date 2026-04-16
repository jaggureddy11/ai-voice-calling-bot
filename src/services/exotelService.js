const axios = require('axios');

/**
 * Triggers an outbound call using Exotel Connect API.
 * This will hit our dynamic ExoML endpoint to start the conversation.
 */
const createCall = async (to, callLogId) => {
  const { EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SUBDOMAIN, EXOTEL_CALLER_ID, BASE_URL } = process.env;
  
  const url = `https://${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}@${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_SID}/Calls/connect.json`;
  
  // Try HTTP for telephony bots often have SSL handshake issues with free tunnels
  const exomlUrl = `${BASE_URL.replace('https://', 'http://')}/api/calls/exotel/voice?callLogId=${callLogId}`;

  try {
    const response = await axios.post(url, new URLSearchParams({
      From: to,
      CallerId: EXOTEL_CALLER_ID,
      Url: exomlUrl,
      CallType: 'trans'
    }).toString());
    
    console.log(`[Exotel Call]: Initiated successfully. Call SID: ${response.data.Call.Sid}`);
    return response.data.Call.Sid;
  } catch (error) {
    console.error('[Exotel Call Error]:', error.response ? error.response.data : error.message);
    throw error;
  }
};


module.exports = { createCall };

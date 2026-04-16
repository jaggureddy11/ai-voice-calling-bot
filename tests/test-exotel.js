/**
 * Exotel Outbound Call Test Script
 */

require('dotenv').config();
const { createCall } = require('../src/services/exotelService');

async function testExotelCall() {
  const testNumber = process.argv[2] || "+919110300509";
  
  console.log(`📡 Starting Exotel test call to: ${testNumber}`);
  console.log(`Using SID: ${process.env.EXOTEL_SID}`);

  try {
    const sid = await createCall(testNumber, null);
    
    console.log("\n✅ Exotel Call Initiated!");
    console.log(`Call SID: ${sid}`);
    console.log(`Carrier: Exotel (Indian Compliance)`);
    console.log(`ExoML URL: ${process.env.BASE_URL}/api/calls/exotel/voice`);
    
    console.log("\n-----------------------------------------");
    console.log("The passenger will hear the Premium Kokoro voice.");
    console.log("Check your server terminal for live logs.");
    console.log("-----------------------------------------");

  } catch (error) {
    console.error("\n❌ Exotel Test Failed:");
    console.error(error.message);
  }
}

testExotelCall();

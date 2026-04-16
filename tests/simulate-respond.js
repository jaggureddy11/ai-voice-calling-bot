/**
 * Simulate a call response from a passenger
 * This tests:
 * 1. AI Intent extraction (Groq)
 * 2. Premium voice generation (Hugging Face)
 * 3. Supabase logging
 */

require('dotenv').config();

async function simulate() {
  const payload = {
    SpeechResult: "I am running late by 10 minutes",
    CallSid: "CA" + "a".repeat(32)
  };

  console.log("🚀 Simulating call response...");
  console.log(`Input: "${payload.SpeechResult}"`);

  try {
    const response = await fetch('http://localhost:3000/api/calls/voice/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const xml = await response.text();
    console.log("\n✅ Response received from API:");
    console.log("-----------------------------------------");
    console.log(xml);
    console.log("-----------------------------------------");

    if (xml.includes('<Play>')) {
      const audioUrl = xml.match(/<Play>(.*?)<\/Play>/)[1];
      console.log(`\n🔊 Premium Voice Generated: ${audioUrl}`);
    } else {
      console.log("\n⚠️ Fallback voice used (check logs for errors)");
    }

  } catch (error) {
    console.error("❌ Simulation failed:", error.message);
  }
}

simulate();

/**
 * Hugging Face Inference API Service
 * 
 * Provides high-performance Voice (TTS) and Speech (STT) capabilities
 * using the hexgrad/Kokoro-82M and openai/whisper-large-v3-turbo models.
 */

const fs = require('fs');
const path = require('path');

const HF_TOKEN = process.env.HF_TOKEN;

// Ensure artifacts directory exists for temporary audio storage
const AUDIO_DIR = path.join(__dirname, '../../public/voice_cache');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Text-to-Speech using Kokoro-82M (hexgrad/Kokoro-82M)
 * Generates highly lifelike audio for calling responses.
 */
const generateSpeech = async (text, voiceId = 'af_bella') => {
  console.log(`[HF Voice]: Generating speech for: "${text.substring(0, 30)}..."`);
  
  try {
    const response = await fetch(
      "https://router.huggingface.co/fal-ai/fal-ai/kokoro/american-english",
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ text: text }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HF TTS Error: ${response.statusText} - ${errText}`);
    }

    const buffer = await response.arrayBuffer();
    const filename = `voice_${Date.now()}.mp3`;
    const filepath = path.join(AUDIO_DIR, filename);
    
    fs.writeFileSync(filepath, Buffer.from(buffer));
    
    return `${process.env.BASE_URL}/voice_cache/${filename}`;
  } catch (error) {
    console.error('[HF Voice Error]:', error);
    return null;
  }
};


/**
 * Speech-to-Text using Whisper-v3-Turbo
 * Note: This requires the audio bytes from Twilio.
 */
const transcribeSpeech = async (audioBuffer) => {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/openai/whisper-large-v3-turbo",
      {
        headers: { Authorization: `Bearer ${HF_TOKEN}` },
        method: "POST",
        body: audioBuffer,
      }
    );

    const result = await response.json();
    return result.text;
  } catch (error) {
    console.error('[HF STT Error]:', error);
    return null;
  }
};

module.exports = { generateSpeech, transcribeSpeech };

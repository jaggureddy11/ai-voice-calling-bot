/**
 * BoardPing Voice Cache Cleanup
 * Automatically deletes old generated audio files to save disk space.
 */

const fs = require('fs');
const path = require('path');

const AUDIO_DIR = path.join(__dirname, '../../public/voice_cache');
const MAX_AGE_MS = 1000 * 60 * 60; // 1 hour

const cleanupVoiceCache = () => {
  if (!fs.existsSync(AUDIO_DIR)) return;

  const now = Date.now();
  const files = fs.readdirSync(AUDIO_DIR);

  let deletedCount = 0;

  files.forEach(file => {
    const filePath = path.join(AUDIO_DIR, file);
    const stats = fs.statSync(filePath);

    if (now - stats.mtimeMs > MAX_AGE_MS) {
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  });

  if (deletedCount > 0) {
    console.log(`[Cache Cleanup]: Removed ${deletedCount} expired voice files.`);
  }
};

// Run cleanup every 30 minutes
setInterval(cleanupVoiceCache, 1000 * 60 * 30);

module.exports = { cleanupVoiceCache };

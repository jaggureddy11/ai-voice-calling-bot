const supabase = require('../config/supabase');
const { notifyJourneyLogic } = require('../controllers/callController');

/**
 * Scans journeys departing in roughly 30 minutes and triggers calls.
 */
const startJourneyScheduler = () => {
  console.log('🕒 Journey Scheduler started (Automatic Dispatches enabled)');
  
  // Run every 60 seconds
  setInterval(async () => {
    try {
      const now = new Date();
      
      // Calculate departure window (30 minutes from now)
      const targetTime = new Date(now.getTime() + 30 * 60000);
      const hours = targetTime.getHours().toString().padStart(2, '0');
      const minutes = targetTime.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      console.log(`[Scheduler] Checking for departures at ${timeStr}...`);

      // Find journeys departing at this time that haven't been notified
      const { data: journeys, error } = await supabase
        .from('journeys')
        .select('id')
        .eq('departure_time', timeStr)
        .is('notified_at', null);

      if (error) throw error;

      for (const journey of journeys) {
        console.log(`[Scheduler] Auto-triggering calls for Journey: ${journey.id}`);
        
        // Use the internal logic to trigger calls
        await notifyJourneyLogic(journey.id);

        // Mark as notified
        await supabase
          .from('journeys')
          .update({ notified_at: new Date().toISOString() })
          .eq('id', journey.id);
      }
    } catch (err) {
      console.error('[Scheduler Error]:', err.message);
    }
  }, 60000);
};

module.exports = { startJourneyScheduler };

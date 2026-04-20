const supabase = require('../config/supabase');
const { notifyJourneyLogic } = require('../controllers/callController');

/**
 * Scans journeys departing in roughly 30 minutes and triggers calls.
 * Runs every minute to ensure timely notifications.
 */
const startJourneyScheduler = () => {
  console.log('🕒 Journey Scheduler: Active (Autonomous Dispatch Mode)');
  
  setInterval(async () => {
    try {
      const now = new Date();
      
      // Target window: 30 minutes from now
      const targetTime = new Date(now.getTime() + 30 * 60000);
      
      // Generate two targets (current minute and next minute) for redundancy
      const getStr = (d) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      
      const timeStrCurrent = getStr(targetTime);
      const timeStrNext = getStr(new Date(targetTime.getTime() + 60000));

      console.log(`[Scheduler] Checking for departures between ${timeStrCurrent} and ${timeStrNext}...`);

      // Find journeys departing in this window that haven't been notified
      const { data: journeys, error } = await supabase
        .from('journeys')
        .select('id, departure_time')
        .in('departure_time', [timeStrCurrent, timeStrNext])
        .is('notified_at', null);

      if (error) throw error;

      if (journeys && journeys.length > 0) {
        console.log(`[Scheduler] Found ${journeys.length} pending journeys.`);
        
        for (const journey of journeys) {
          console.log(`[Scheduler] Auto-triggering Journey: ${journey.id}`);
          
          try {
            await notifyJourneyLogic(journey.id);
            
            // Mark as notified in Supabase immediately
            await supabase
              .from('journeys')
              .update({ notified_at: new Date().toISOString() })
              .eq('id', journey.id);
              
          } catch (logicErr) {
            console.error(`[Scheduler] Logic failure for Journey ${journey.id}:`, logicErr.message);
          }
        }
      }
    } catch (err) {
      console.error('[Scheduler Critical Error]:', err.message);
    }
  }, 60000);
};

module.exports = { startJourneyScheduler };

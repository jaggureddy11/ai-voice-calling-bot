const supabase = require('../config/supabase');
const { addCallToQueue } = require('../jobs/callQueue');
const aiService = require('../services/aiService');
const { generateSpeech } = require('../services/hfService');
const { sendSMS } = require('../services/smsService');
const crypto = require('crypto');

/**
 * Controller for handling all telephony and passenger related operations.
 */

const getOperators = async (req, res) => {
  const { data, error } = await supabase.from('operators').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data || []);
};

const getAgencies = async (req, res) => {
  const { operatorId } = req.query;
  let query = supabase.from('agencies').select('*');
  if (operatorId) query = query.eq('operator_id', operatorId);
  
  const { data, error } = await query.order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data || []);
};

const getBuses = async (req, res) => {
  const { agencyId } = req.query;
  let query = supabase.from('buses').select('*');
  if (agencyId) query = query.eq('agency_id', agencyId);
  
  const { data, error } = await query.order('time');
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data || []);
};

const getPassengers = async (req, res) => {
  const { busId } = req.params;
  const { data, error } = await supabase
    .from('passengers')
    .select(`
      id, 
      name, 
      phone, 
      boarding_point, 
      seat_no,
      time, 
      is_boarded,
      call_status,
      call_logs ( 
        status, 
        created_at, 
        attempt_count, 
        last_error, 
        duration,
        is_flagged
      )
    `)
    .eq('bus_id', busId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data || []);
};

const addPassenger = async (req, res) => {
  const { bus_id, name, phone, boarding_point, seat_no, time, language } = req.body;
  
  const { data, error } = await supabase
    .from('passengers')
    .insert([{ 
        id: 'p_' + Date.now(),
        bus_id, name, phone, boarding_point, seat_no, time, language 
    }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data[0]);
};

/**
 * Triggers notification calls for an entire journey/bus.
 */
const notifyJourney = async (req, res) => {
  try {
    const busId = req.body.busId || req.body.journeyId || req.params.journeyId;
    if (!busId) return res.status(400).json({ error: 'busId is required.' });

    const result = await notifyJourneyLogic(busId);
    res.status(200).json(result);
  } catch (error) {
    console.error('[CallController] Error triggering journey calls:', error);
    res.status(500).json({ error: error.message });
  }
};

const notifyJourneyLogic = async (busId) => {
  const traceId = crypto.randomBytes(4).toString('hex');
  console.log(`[Trace:${traceId}] 🚀 Starting Notification Batch for bus: ${busId}`);

  const { data: passengers, error: fetchError } = await supabase
    .from('passengers')
    .select('*')
    .eq('bus_id', busId);

  if (fetchError || !passengers || passengers.length === 0) {
    console.warn(`[Trace:${traceId}] No passengers found for this journey.`);
    return { success: false, message: 'No passengers found.' };
  }

  let queuedCount = 0;
  for (const passenger of passengers) {
    if (!passenger.phone) continue;
    
    try {
      // Initialize call log entry
      const { data: callLog, error: logError } = await supabase
        .from('call_logs')
        .insert([{ 
          passenger_id: passenger.id, 
          status: 'queued',
          attempt_count: 0
        }])
        .select()
        .single();
        
      if (logError) throw logError;

      const passengerPayload = {
        ...passenger,
        callLogId: callLog.id 
      };

      await addCallToQueue({ 
        ...passengerPayload, 
        traceId 
      });
      queuedCount++;
    } catch (err) {
      console.error(`[Trace:${traceId}] Failed to queue passenger ${passenger.id}:`, err.message);
    }
  }

  console.log(`[Trace:${traceId}] 🏁 Batch Dispatch Complete. Total queued: ${queuedCount}`);
  return {
    success: true,
    message: `Successfully queued calls for ${queuedCount} passengers.`
  };
};

/**
 * TELEPHONY HANDLERS
 */

const handleIncomingVoice = (req, res) => {
  const twimlObj = new twilio.twiml.VoiceResponse();
  const gather = twimlObj.gather({
    input: 'speech',
    action: '/api/calls/voice/respond',
    speechTimeout: 'auto',
    language: 'en-IN'
  });
  
  gather.say({ voice: 'Polly.Aditi', language: 'en-IN' }, 
    'Namaste! Welcome to AbhiBus assistant. How can I help you today?'
  );

  res.set('Content-Type', 'text/xml');
  res.send(twimlObj.toString());
};

const handleExotelVoice = async (req, res) => {
  const { callLogId } = req.query;
  const traceId = crypto.randomBytes(3).toString('hex');
  console.log(`[Trace:${traceId}] Incoming Exotel session for Log:${callLogId}`);

  try {
    let greeting = 'Namaste! Welcome to BoardPing.';
    
    if (callLogId) {
      const { data } = await supabase
        .from('call_logs')
        .select('passengers(name, boarding_point, time, buses(agency_id))')
        .eq('id', callLogId)
        .single();
      
      if (data?.passengers) {
        const p = data.passengers;
        greeting = `Namaste ${p.name}, our bus to ${p.boarding_point} is departing at ${p.time}. Please reach the boarding point 15 minutes early.`;
      }
    }

    const hfUrl = await generateSpeech(greeting);

    res.set('Content-Type', 'text/xml');
    let exoml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    
    if (hfUrl) {
      exoml += `    <Gather action="${process.env.BASE_URL}/api/calls/voice/respond?callLogId=${callLogId}" input="speech" timeout="5" language="en-IN">\n`;
      exoml += `        <Play>${hfUrl}</Play>\n`;
      exoml += `    </Gather>\n`;
      exoml += `    <Redirect>${process.env.BASE_URL}/api/calls/voice/respond?callLogId=${callLogId}&amp;timeout=true</Redirect>\n`;
    } else {
      exoml += `    <Say voice="female" language="en-IN">${greeting}</Say>\n`;
    }
    
    exoml += '</Response>';
    res.send(exoml);

  } catch (error) {
    console.error(`[Trace:${traceId}] ExoML Error:`, error.message);
    res.status(500).send('<Response><Hangup/></Response>');
  }
};

const handleVoiceRespond = async (req, res) => {
  const userSpeech = req.body.SpeechResult;
  const callLogId = req.query.callLogId;
  const twimlObj = new twilio.twiml.VoiceResponse();

  if (timeout || !userSpeech || userSpeech.trim().length === 0) {
    // If user didn't speak, or it's a timeout, trigger SMS fallback
    console.log(`[VoiceRespond] No user speech for Log:${callLogId}. Triggering SMS fallback.`);
    return sendSMSFallbackInternal(callLogId, req, res);
  }

  try {
      let passengerName = 'Unknown';
      let passengerLanguage = 'en-IN';

      if (callLogId) {
        const { data: logData } = await supabase
          .from('call_logs')
          .select('passenger_id, passengers(name, language)')
          .eq('id', callLogId)
          .single();
        
        if (logData && logData.passengers) {
          passengerName = logData.passengers.name;
          passengerLanguage = logData.passengers.language || 'en-IN';
        }
      }

      const { intent, response: aiResponse } = await aiService.analyzeIntent(userSpeech, passengerLanguage);
      const hfUrl = await generateSpeech(aiResponse);

      // Log AI Interaction
      await supabase.from('ai_logs').insert([{
        call_log_id: callLogId,
        passenger_name: passengerName,
        user_speech: userSpeech,
        bot_response: aiResponse,
        intent: intent,
        sentiment: intent !== 'GENERAL' ? 'Urgent' : 'Neutral'
      }]);

      if (['LATE', 'CANCEL', 'URGENT'].includes(intent)) {
        await supabase.from('call_logs').update({ is_flagged: true }).eq('id', callLogId);
      }

      if (hfUrl) {
          res.type('application/xml');
          res.send(`
            <Response>
                <Play>${hfUrl}</Play>
                <Hangup/>
            </Response>
          `);
      } else {
        res.type('application/xml');
        res.send(`<Response><Say language="en-IN">${aiResponse}</Say><Hangup/></Response>`);
      }
  } catch (error) {
    console.error('[VoiceRespond Error]:', error.message);
    res.status(500).send('<Response><Hangup/></Response>');
  }
};

/**
 * Internal Helper for SMS Fallback
 */
const sendSMSFallbackInternal = async (callLogId, req, res) => {
    try {
      const { data: log } = await supabase.from('call_logs').select('*, passengers(*)').eq('id', callLogId).single();
      const p = log.passengers;
      
      const message = `Hi ${p.name}, our AI assistant couldn't reach you. Your bus departs from ${p.boarding_point} at ${p.time}. Please be there early!`;
      
      await sendSMS(p.phone, message);

      if (res) {
          res.type('application/xml');
          res.send('<Response><Say language="en-IN">I could not hear you. I am sending the details via S.M.S. Have a safe journey!</Say><Hangup/></Response>');
      }
    } catch (err) {
      console.error('[Fallback SMS Error]:', err.message);
      if (res) res.status(500).send('<Response><Hangup/></Response>');
    }
};

const handleVoiceStatus = async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;

  try {
    const updatePayload = {
      status: CallStatus, 
      duration: CallDuration ? parseInt(CallDuration) : 0
    };

    if (['failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)) {
      updatePayload.last_error = `Provider status: ${CallStatus}`;
    }

    await supabase.from('call_logs').update(updatePayload).eq('twilio_sid', CallSid);
    res.status(200).send('OK');
  } catch (error) {
    console.error('[VoiceStatus Error]:', error);
    res.status(500).send('Internal Server Error');
  }
};

const sendSMSFallback = async (req, res) => {
  const { passengerId, message } = req.body;
  const twilioClient = require('../config/twilio');

  try {
    const { data: p } = await supabase
      .from('passengers')
      .select('name, phone')
      .eq('id', passengerId)
      .single();

    const sms = await twilioClient.messages.create({
      body: message || `Hi ${p.name}, our AI assistant couldn't reach you. Your bus departs soon. Please be at the boarding point!`,
      to: p.phone,
      from: process.env.TWILIO_FROM_NUMBER 
    });

    await supabase.from('call_logs').update({ status: 'sms-sent' }).eq('passenger_id', passengerId);
    res.status(200).json({ success: true, sid: sms.sid });
  } catch (err) {
    console.error('[SMSFallback Error]:', err);
    res.status(500).json({ error: 'Failed to send SMS.' });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const { data: totalBuses } = await supabase.from('buses').select('id', { count: 'exact', head: true });
    const { data: totalPassengers } = await supabase.from('passengers').select('id', { count: 'exact', head: true });
    const { data: boardedPassengers } = await supabase.from('passengers').select('id', { count: 'exact', head: true }).eq('is_boarded', true);
    const { data: callLogs } = await supabase.from('call_logs').select('status');

    const successCalls = (callLogs || []).filter(c => c.status === 'completed' || c.status === 'success').length;
    const totalCalls = (callLogs || []).length;
    const successRate = totalCalls > 0 ? ((successCalls / totalCalls) * 100).toFixed(1) : '100';

    res.status(200).json({
      activeTrips: totalBuses?.length || 0,
      totalPassengers: totalPassengers?.length || 0,
      boardedCount: boardedPassengers?.length || 0,
      successRate: `${successRate}%`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const seedDatabase = async (req, res) => {
  try {
    const operators = [
      { id: 'op_abhi', name: 'Abhibus', tag: 'Smart Partner', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/da/53/3b/da533b00-49a9-1924-4081-7c359e29a306/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-85-220.png/512x512bb.jpg' },
      { id: 'op_red', name: 'Redbus', tag: 'Global', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/6c/5e/69/6c5e69e7-7df0-2c27-ed2d-1d6d0c02fd03/AppIconiOS26-0-0-1x_U007ephone-0-1-0-sRGB-85-220.png/512x512bb.jpg' }
    ];

    const agencies = [
      { id: 'ag_vrl', name: 'VRL Travels', route_count: 145, rating: 4.8, operator_id: 'op_abhi' },
      { id: 'ag_srs', name: 'SRS Travels', route_count: 89, rating: 4.5, operator_id: 'op_abhi' }
    ];

    const buses = [
      { id: 'b_1', number: 'KA 01 AB 1234', agency_id: 'ag_vrl', route: 'BLR → HYD', time: '20:30', status: 'upcoming' },
      { id: 'b_2', number: 'KA 04 VTR 5566', agency_id: 'ag_vrl', route: 'BLR → PUNE', time: '21:15', status: 'boarding' }
    ];

    // Seed Journeys for the Scheduler (30 minutes from now)
    const now = new Date();
    const thirtyMinsLater = new Date(now.getTime() + 30 * 60000);
    const departureTime = `${thirtyMinsLater.getHours().toString().padStart(2, '0')}:${thirtyMinsLater.getMinutes().toString().padStart(2, '0')}`;

    const journeys = [
      { id: 'j_1', bus_id: 'b_1', departure_time: departureTime, notified_at: null },
      { id: 'j_2', bus_id: 'b_2', departure_time: '23:59', notified_at: null }
    ];

    const passengers = [
      { id: 'p_demo1', bus_id: 'b_1', name: 'John Doe', phone: '9876543210', boarding_point: 'Majestic', seat_no: 'A1', time: departureTime },
      { id: 'p_demo2', bus_id: 'b_1', name: 'Jane Smith', phone: '9123456789', boarding_point: 'Electronix City', seat_no: 'B4', time: departureTime }
    ];

    await supabase.from('operators').upsert(operators);
    await supabase.from('agencies').upsert(agencies);
    await supabase.from('buses').upsert(buses);
    await supabase.from('journeys').upsert(journeys);
    await supabase.from('passengers').upsert(passengers);

    res.status(200).json({ success: true, message: 'Database seeded with demographic data and active journeys.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAILogs = async (req, res) => {
  const { data, error } = await supabase
    .from('ai_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data || []);
};

const toggleBoardingStatus = async (req, res) => {
  const { passengerId } = req.params;
  const { is_boarded } = req.body;
  
  const { data, error } = await supabase
    .from('passengers')
    .update({ is_boarded })
    .eq('id', passengerId)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data[0]);
};

module.exports = {
  getOperators,
  getAgencies,
  getBuses,
  getPassengers,
  addPassenger,
  notifyJourney,
  toggleBoardingStatus,
  handleIncomingVoice,
  handleVoiceRespond,
  handleVoiceStatus,
  handleExotelVoice,
  sendSMSFallback,
  getDashboardStats,
  getAILogs,
  seedDatabase,
  notifyJourneyLogic
};


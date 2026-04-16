const supabase = require('../config/supabase');
const { addCallToQueue } = require('../jobs/callQueue');
const aiService = require('../services/aiService');

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
  
  // Use bus_id for linking
  const { data, error } = await supabase
    .from('passengers')
    .insert([{ bus_id, name, phone, boarding_point, seat_no, time, language }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data[0]);
};

const notifyJourney = async (req, res) => {
  try {
    const journeyId = req.body.journeyId || req.params.journeyId;
    const { force, message_override } = req.body;
    
    if (!journeyId) return res.status(400).json({ error: 'journeyId is required.' });

    const result = await notifyJourneyLogic(journeyId);
    res.status(200).json(result);
  } catch (error) {

    console.error('Error triggering journey calls:', error);
    res.status(500).json({ error: error.message });
  }
};

const notifyJourneyLogic = async (journeyId) => {
  console.log(`Fetching passengers for journey ${journeyId} from Supabase...`);

  // Fetch passengers
  const { data: passengers, error: fetchError } = await supabase
    .from('passengers')
    .select('*')
    .eq('journey_id', journeyId);

  if (fetchError || !passengers || passengers.length === 0) {
    throw new Error('No passengers found for this journey.');
  }

  let queuedCount = 0;

  for (const passenger of passengers) {
    if (!passenger.phone) continue;
    
    // Create a Call Log in Supabase FIRST to mark as initiated
    const { data: callLog, error: logError } = await supabase
      .from('call_logs')
      .insert([{ 
        passenger_id: passenger.id, 
        status: 'queued',
        attempt_count: 0
      }])
      .select()
      .single();
      
    if (logError) {
        console.error('Error creating call log:', logError);
        continue;
    }

    // Inject callLogId so the worker can update it later
    const passengerPayload = {
      ...passenger,
      callLogId: callLog.id 
    };

    // Push passenger task to job queue
    await addCallToQueue(passengerPayload);
    queuedCount++;
  }

  return {
    success: true,
    message: `Successfully fetched and queued calls for ${queuedCount} passengers on journey ${journeyId}.`
  };
};

const twilio = require('twilio');

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
  console.log(`[Exotel Webhook Hit]: LogID=${callLogId}`);

  try {
    let greeting = 'Namaste! Welcome to BoardPing.';
    
    if (callLogId) {
      const { data } = await supabase.from('call_logs').select('passengers(name, boarding_point, time)').eq('id', callLogId).single();
      if (data?.passengers) {
        const p = data.passengers;
        greeting = `Namaste ${p.name}, our bus to ${p.boarding_point} is departing at ${p.time}. Please reach 15 minutes early.`;
      }
    }

    console.log(`[Exotel AI]: Generating premium voice for: "${greeting.substring(0, 20)}..."`);
    
    const { generateSpeech } = require('../services/hfService');
    const hfUrl = await generateSpeech(greeting);

    res.set('Content-Type', 'text/xml');
    let exoml = '<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n';
    
    if (hfUrl) {
      exoml += `    <Play>${hfUrl}</Play>\n`;
    } else {
      console.warn('[Exotel AI Warning]: HF Voice failed, using <Say> fallback.');
      exoml += `    <Say voice="female" language="en-IN">${greeting}</Say>\n`;
    }
    
    exoml += '    <Hangup/>\n</Response>';
    
    console.log(`[Exotel Response]: Sending ExoML (HF=${!!hfUrl})`);
    res.send(exoml);

  } catch (error) {
    console.error('[Exotel ExoML Error]:', error);
    res.status(500).send('Error generating response');
  }
};


const handleVoiceRespond = async (req, res) => {

  const userSpeech = req.body.SpeechResult;
  const callLogId = req.query.callLogId;
  const twimlObj = new twilio.twiml.VoiceResponse();

  if (!userSpeech || userSpeech.trim().length === 0) {
    twimlObj.say({ voice: 'Polly.Aditi', language: 'en-IN' }, 'I did not catch that. Could you please repeat?');
    twimlObj.redirect(`/api/calls/voice/${callLogId ? `?callLogId=${callLogId}` : ''}`); 
    res.set('Content-Type', 'text/xml');
    return res.send(twimlObj.toString());
  }

  console.log(`[Caller Said]: ${userSpeech}`);

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

      // Analyze intent using our new service
      const { intent, response: aiResponse } = await aiService.analyzeIntent(userSpeech, passengerLanguage);
      console.log(`[Intent]: ${intent} -> [AI Response]: ${aiResponse}`);

      // NEW: Generate High-Fidelity Speech via Hugging Face (Kokoro-82M)
      const { generateSpeech } = require('../services/hfService');
      const hfUrl = await generateSpeech(aiResponse);
      console.log(`[HF Debug] Generated URL: ${hfUrl}`);

      // LOG TO SUPABASE
      await supabase.from('ai_logs').insert([{
        call_log_id: callLogId,
        passenger_name: passengerName,
        user_speech: userSpeech,
        bot_response: aiResponse,
        intent: intent,
        sentiment: intent !== 'GENERAL' ? 'Urgent' : 'Neutral'
      }]);

      // If LATE or CANCEL, flag the call log for the operator dashboard
      if (['LATE', 'CANCEL', 'URGENT'].includes(intent)) {
        await supabase
          .from('call_logs')
          .update({ is_flagged: true })
          .eq('id', callLogId);
      }

      const gather = twimlObj.gather({
        input: 'speech',
        action: `/api/calls/voice/respond${callLogId ? `?callLogId=${callLogId}` : ''}`,
        speechTimeout: 'auto',
        language: passengerLanguage
      });
      
      if (hfUrl) {
        // Use the premium Hugging Face voice
        gather.play(hfUrl);
      } else {
        // Fallback to Twilio standard
        gather.say({ voice: 'Polly.Aditi', language: passengerLanguage }, aiResponse);
      }


    res.set('Content-Type', 'text/xml');
    res.send(twimlObj.toString());
  } catch (error) {
    console.error('AI Interaction Error:', error);
    twimlObj.say({ voice: 'Polly.Aditi', language: 'en-IN' }, 'Sorry, my system is currently down. Please try again later.');
    res.set('Content-Type', 'text/xml');
    res.send(twimlObj.toString());
  }
};

const handleVoiceStatus = async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  console.log(`[Twilio Status Update] Sid: ${CallSid} Status: ${CallStatus} Duration: ${CallDuration}s`);

  try {
    const updatePayload = {
      status: CallStatus, 
      duration: CallDuration ? parseInt(CallDuration) : 0
    };

    if (['failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)) {
      updatePayload.last_error = `Provider status: ${CallStatus}`;
    }

    await supabase
      .from('call_logs')
      .update(updatePayload)
      .eq('twilio_sid', CallSid);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error updating call status:', error);
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
    console.error('SMS Fallback Error:', err);
    res.status(500).json({ error: 'Failed to send SMS.' });
  }
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
  getAILogs,
  notifyJourneyLogic
};


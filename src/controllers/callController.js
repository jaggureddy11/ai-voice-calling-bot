const supabase = require('../config/supabase');
const { addCallToQueue } = require('../jobs/callQueue');

const getPassengers = async (req, res) => {
  const { journeyId } = req.params;
  const { data, error } = await supabase
    .from('passengers')
    .select(`
      id, 
      name, 
      phone, 
      boarding_point, 
      time, 
      call_logs ( 
        status, 
        created_at, 
        attempt_count, 
        last_error, 
        duration,
        is_flagged
      )
    `)
    .eq('journey_id', journeyId)
    .order('id', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json(data || []);
};

const addPassenger = async (req, res) => {
  const { journey_id, name, phone, boarding_point, time, language } = req.body;
  
  // Upsert the journey dynamically to completely prevent Foreign Key constraint errors
  await supabase.from('journeys').upsert([{ 
    id: journey_id, 
    route: 'Dynamic Terminal Route', 
    departure_time: time 
  }], { onConflict: 'id' });

  const { data, error } = await supabase
    .from('passengers')
    .insert([{ journey_id, name, phone, boarding_point, time, language }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
};

const notifyJourney = async (req, res) => {
  try {
    const journeyId = req.body.journeyId || req.params.journeyId;
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
const OpenAI = require('openai');

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

const handleVoiceRespond = async (req, res) => {
  const userSpeech = req.body.SpeechResult;
  const callLogId = req.query.callLogId;
  const twimlObj = new twilio.twiml.VoiceResponse();

  if (!userSpeech) {
    twimlObj.say({ voice: 'Polly.Aditi', language: 'en-IN' }, 'I did not catch that. Could you please repeat?');
    twimlObj.redirect('/api/calls/voice'); // Send them back to the start
    res.set('Content-Type', 'text/xml');
    return res.send(twimlObj.toString());
  }

  console.log(`[Caller Said]: ${userSpeech}`);

  try {
    // LOG TO SUPABASE
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

      const openai = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      });

      const completion = await openai.chat.completions.create({
        model: 'llama-3.3-70b-versatile', 
        messages: [
          { 
            role: 'system', 
            content: `You are a helpful bus assistant. 
            Identify if the user is LATE, CANCELING, or just ASKING A QUESTION.
            Respond in this format: [INTENT: XXX] Your response here.
            Language: ${passengerLanguage}. Keep response under 2 sentences.` 
          },
          { role: 'user', content: userSpeech }
        ]
      });

      let fullContent = completion.choices[0].message.content;
      console.log(`[AI Raw]: ${fullContent}`);

      // Extract Intent
      let detectedIntent = 'GENERAL';
      if (fullContent.includes('[INTENT: LATE]')) detectedIntent = 'LATE';
      if (fullContent.includes('[INTENT: CANCEL]')) detectedIntent = 'CANCEL';
      
      const aiResponse = fullContent.replace(/\[INTENT: .*?\]/, '').trim();

      await supabase.from('ai_logs').insert([{
        call_log_id: callLogId,
        passenger_name: passengerName,
        user_speech: userSpeech,
        bot_response: aiResponse,
        intent: detectedIntent,
        sentiment: detectedIntent !== 'GENERAL' ? 'Urgent' : 'Neutral'
      }]);

      // If LATE or CANCEL, flag the call log for the operator dashboard
      if (detectedIntent === 'LATE' || detectedIntent === 'CANCEL') {
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
      
      gather.say({ voice: 'Polly.Aditi', language: passengerLanguage }, aiResponse);

    res.set('Content-Type', 'text/xml');
    res.send(twimlObj.toString());
  } catch (error) {
    console.error('Groq Error:', error);
    twimlObj.say({ voice: 'Polly.Aditi', language: 'en-IN' }, 'Sorry, my system is currently down. Please try again later.');
    res.set('Content-Type', 'text/xml');
    res.send(twimlObj.toString());
  }
};

const handleVoiceStatus = async (req, res) => {
  const { CallSid, CallStatus, CallDuration, ApiVersion } = req.body;
  console.log(`[Twilio Status Update] Sid: ${CallSid} Status: ${CallStatus} Duration: ${CallDuration}s`);

  try {
    // Map Twilio statuses to our internal SaaS statuses
    const updatePayload = {
      status: CallStatus, // 'completed', 'busy', 'no-answer', 'failed', 'canceled'
      duration: CallDuration ? parseInt(CallDuration) : 0
    };

    if (CallStatus === 'failed') {
      updatePayload.last_error = 'Telephony provider error';
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
      from: process.env.TWILIO_FROM_NUMBER // Assuming SMS capability on this number
    });

    // Update status to 'completed' as fallback is done
    await supabase.from('call_logs').update({ status: 'sms-sent' }).eq('passenger_id', passengerId);

    res.status(200).json({ success: true, sid: sms.sid });
  } catch (err) {
    console.error('SMS Fallback Error:', err);
    res.status(500).json({ error: 'Failed to send SMS.' });
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

module.exports = {
  getPassengers,
  addPassenger,
  notifyJourney,
  handleIncomingVoice,
  handleVoiceRespond,
  handleVoiceStatus,
  sendSMSFallback,
  getAILogs,
  notifyJourneyLogic
};

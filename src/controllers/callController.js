const supabase = require('../config/supabase');
const { addCallToQueue } = require('../jobs/callQueue');

const getPassengers = async (req, res) => {
  const { journeyId } = req.params;
  const { data, error } = await supabase
    .from('passengers')
    .select(`id, name, phone, boarding_point, time, call_logs ( status )`)
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
    // Allows passing journeyId in body or query/params flexibly
    const journeyId = req.body.journeyId || req.params.journeyId;

    if (!journeyId) {
      return res.status(400).json({ error: 'journeyId is required.' });
    }

    console.log(`Fetching passengers for journey ${journeyId} from Supabase...`);

    // Fetch passengers
    const { data: passengers, error: fetchError } = await supabase
      .from('passengers')
      .select('*')
      .eq('journey_id', journeyId);

    if (fetchError || !passengers || passengers.length === 0) {
      return res.status(404).json({ error: 'No passengers found for this journey.' });
    }

    let queuedCount = 0;

    for (const passenger of passengers) {
      if (!passenger.phone) continue;
      
      // Create a Call Log in Supabase FIRST to mark as initiated
      const { data: callLog, error: logError } = await supabase
        .from('call_logs')
        .insert([{ passenger_id: passenger.id, status: 'initiated' }])
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

    res.status(200).json({
      success: true,
      message: `Successfully fetched and queued calls for ${queuedCount} passengers on journey ${journeyId}.`
    });

  } catch (error) {
    console.error('Error triggering journey calls:', error);
    res.status(500).json({ error: 'Internal Server Error while queueing calls.' });
  }
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
  const twimlObj = new twilio.twiml.VoiceResponse();

  if (!userSpeech) {
    twimlObj.say({ voice: 'Polly.Aditi', language: 'en-IN' }, 'I did not catch that. Could you please repeat?');
    twimlObj.redirect('/api/calls/voice'); // Send them back to the start
    res.set('Content-Type', 'text/xml');
    return res.send(twimlObj.toString());
  }

  console.log(`[Caller Said]: ${userSpeech}`);

  try {
    const openai = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const completion = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile', 
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful and polite bus booking assistant for AbhiBus in India. Keep your answers extremely short (1 to 2 sentences max) so that the phone caller does not get bored. You are speaking over the phone, so avoid emojis or special characters.' 
        },
        { role: 'user', content: userSpeech }
      ]
    });

    const aiResponse = completion.choices[0].message.content;
    console.log(`[AI Said]: ${aiResponse}`);

    const gather = twimlObj.gather({
      input: 'speech',
      action: '/api/calls/voice/respond',
      speechTimeout: 'auto',
      language: 'en-IN'
    });
    
    gather.say({ voice: 'Polly.Aditi', language: 'en-IN' }, aiResponse);

    res.set('Content-Type', 'text/xml');
    res.send(twimlObj.toString());
  } catch (error) {
    console.error('Groq Error:', error);
    twimlObj.say({ voice: 'Polly.Aditi', language: 'en-IN' }, 'Sorry, my system is currently down. Please try again later.');
    res.set('Content-Type', 'text/xml');
    res.send(twimlObj.toString());
  }
};

module.exports = {
  getPassengers,
  addPassenger,
  notifyJourney,
  handleIncomingVoice,
  handleVoiceRespond
};

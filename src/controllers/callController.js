const { addCallToQueue } = require('../jobs/callQueue');

const notifyJourney = async (req, res) => {
  try {
    const { journeyId, passengers } = req.body;

    if (!journeyId || !passengers || !Array.isArray(passengers)) {
      return res.status(400).json({ error: 'Invalid payload. journeyId and an array of passengers are required.' });
    }

    console.log(`Received trigger to notify ${passengers.length} passengers for journey ${journeyId}.`);

    // DND scrubbing checks can happen here before pushing to queue,
    // or rate-limiting per journeyId

    for (const passenger of passengers) {
      if (!passenger.phone) continue;
      
      // Inject journey context into passenger details
      const passengerPayload = {
        ...passenger,
        journeyId
      };

      // Push passenger task to job queue
      await addCallToQueue(passengerPayload);
    }

    res.status(200).json({
      success: true,
      message: `Successfully queued calls for ${passengers.length} passengers on journey ${journeyId}.`
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
  notifyJourney,
  handleIncomingVoice,
  handleVoiceRespond
};

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

/**
 * Service to handle AI interactions with Groq.
 * Identifies passenger intent and generates appropriate responses.
 */
const analyzeIntent = async (userSpeech, language = 'en-IN') => {
  try {
    const completion = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `You are a helpful bus assistant for BoardPing. 
          Identify if the user is LATE, CANCELING, or just ASKING A QUESTION.
          Respond in this format: [INTENT: XXX] Your response here.
          Language/Locale: ${language}. Keep your response natural and under 2 sentences.`
        },
        { role: 'user', content: userSpeech }
      ],
      temperature: 0.5,
      max_tokens: 150
    });

    const fullContent = completion.choices[0].message.content;
    
    let detectedIntent = 'GENERAL';
    if (fullContent.includes('[INTENT: LATE]')) detectedIntent = 'LATE';
    else if (fullContent.includes('[INTENT: CANCEL]')) detectedIntent = 'CANCEL';
    else if (fullContent.includes('[INTENT: QUESTION]')) detectedIntent = 'QUESTION';

    const cleanResponse = fullContent.replace(/\[INTENT: .*?\]/, '').trim();

    return {
      intent: detectedIntent,
      response: cleanResponse
    };
  } catch (error) {
    console.error('[AI Service Error]:', error);
    throw error;
  }
};

module.exports = { analyzeIntent };

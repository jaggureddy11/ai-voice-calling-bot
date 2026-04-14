require('dotenv').config();
const OpenAI = require('openai');

async function testGroq() {
  console.log('API KEY:', process.env.GROQ_API_KEY ? 'Present' : 'Missing');
  try {
    const openai = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    const completion = await openai.chat.completions.create({
      model: 'llama3-8b-8192', 
      messages: [
        { role: 'user', content: 'Say hello!' }
      ]
    });
    console.log('SUCCESS! Response:', completion.choices[0].message.content);
  } catch (error) {
    console.error('ERROR:', error);
  }
}

testGroq();

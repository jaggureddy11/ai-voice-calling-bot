# BoardPing – AI Voice Boarding Notification System

BoardPing is an AI-powered voice notification system designed to automate passenger communication in bus transportation platforms. Instead of drivers manually calling passengers before departure, this system enables one-click automated voice calls to all passengers, delivering polite, consistent, and multilingual boarding reminders.

Designed to solve real-world operational friction in large-scale transportation systems using scalable distributed architecture.

## 💡 Problem Statement
In current systems:
- Drivers manually call passengers
- Communication can be rushed or unprofessional
- Leads to stress for drivers and poor customer experience
- Not scalable for large platforms

## ✅ Solution
BoardPing introduces:
- 📞 One-click automated calling system
- 🤖 AI-generated or pre-recorded voice messages 
- 🌍 Multi-language support
- ⚡ Scalable architecture using queues and worker systems

## 🧠 System Architecture
1. **Trigger**: Driver clicks “Notify Passengers”
2. **Backend API**: Fetches passenger details, limits rates, checks records
3. **Queue System**: Each passenger is queued as a job via Redis/BullMQ to handle scaling & retries
4. **Worker Pool**: Processes jobs in parallel, generates voice parameters, uses telephony API (Twilio)
5. **Telephony API**: Places outbound calls and plays TwiML (Text-To-Speech) messages!

## 🛠 Tech Stack
- **Backend:** Node.js / Express
- **Queue/Worker:** BullMQ (Redis)
- **Telephony:** Twilio API 
- **TTS:** Twilio built-in TTS (can integrate Sarvam AI / Google TTS later)

## 🚀 Quick Setup (MVP)

### Prerequisites
- Node.js (v18+)
- Redis running on localhost (default port 6379)
- Twilio Account (Account SID, Auth Token, From Number)

### Installation
```bash
git clone https://github.com/jaggureddy11/ai-voice-calling-bot.git
cd ai-voice-calling-bot
npm install
```

### Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

### Running the App
```bash
# Start development server
npm run dev

# Start worker (in a separate terminal)
# Or run both via app index (In MVP they run in the same process for simplicity)
```

### API Endpoints
`POST /api/calls/notify-journey`
Triggers calls for all passengers on a particular journey.
```json
{
  "journeyId": "JNY123",
  "passengers": [
    {
      "name": "Rahul",
      "phone": "+91XXXXXXXXXX",
      "boardingPoint": "Majestic",
      "time": "8:30 PM",
      "language": "hi-IN"
    }
  ]
}
```

## 🎯 Impact
- 🚀 Improves customer experience
- 😌 Reduces driver stress
- 📊 Increases operational efficiency
- 📞 Ensures consistent communication

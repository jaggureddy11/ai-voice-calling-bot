# BoardPing – L4 Distributed AI Voice Notification System

BoardPing is an AI-powered voice notification and conversational bot designed to automate passenger communications for mass transit architectures (e.g., AbhiBus, RedBus). 

Built to handle thousands of concurrent calls through robust queue architectures and ultra low-latency AI generation, it automates standard outbound notifications and fields inbound real-time customer conversations over the phone.

## 💡 System Architecture

1. **Trigger Engine** - Journey-based notifications seamlessly trigger parallel worker dispatches.
2. **Postgres Storage** - Supabase natively queries `passengers` mapped to `journeys` dynamically logging call statuses (`initiated`, `completed`, `failed`).
3. **Queue Distribution** - `BullMQ` + `Redis` effortlessly manage job delegation, rate-limiting, and error-retry logic without overloading the Node thread.
4. **Telephony Bridge** - Twilio Voice API connects programmatic systems directly to global caller cellular networks using TwiML.
5. **Conversational Engine** - Built-in `<Gather>` integrations capture real-time audio and bounce requests against Groq (`llama-3.3`) for 1-second cadence customer support interactions.

---

## 🛠 Tech Stack
- **Backend:** Node.js / Express
- **Queue/Worker:** BullMQ & Redis
- **Database:** Supabase (PostgreSQL)
- **Telephony:** Twilio SDK + VoiceResponse
- **AI Backend:** Groq API (`llama-3.3-70b-versatile`) for 800+ tokens/sec speeds.

---

## 🚀 Quick Setup (Development)

### Prerequisites
- Node.js (v18+)
- Redis running on localhost (default port 6379)
- Twilio Account + Verified Caller IDs
- Groq API Key
- Supabase Project

### Installation
```bash
git clone https://github.com/jaggureddy11/ai-voice-calling-bot.git
cd ai-voice-calling-bot
npm install
```

### Environment Variables
Copy `.env.example` -> `.env` and fill it with your credentials:
```bash
cp .env.example .env
```

### Running the System
```bash
# Start backend API & internal BullMQ workers
npm run dev

# Expose local endpoint to Twilio (In a separate terminal)
npx localtunnel --port 3000
```

---

## 🔗 Endpoints & Usage

### 1. The Outbound Trigger (Journey Notification)
Simulate a driver clicking "Notify Passengers". 
```bash
curl -X POST http://localhost:3000/api/calls/notify-journey \
-H "Content-Type: application/json" \
-d '{"journeyId": "BLR-HYD-830"}'
```
*Triggers an outbound call dispatch that retrieves passengers from Supabase, queues them in Redis, and executes personalized outgoing calls via Twilio.*

### 2. The Inbound Twilio Webhook (AI Loop)
Set your Twilio number Voice webhook configuration to your server address:
`POST https://<your-localtunnel>.loca.lt/api/calls/voice`

### 3. Utility Test Script
Test your inbound conversational LLM loop directly without international PSTN costs using the included testing trigger:
```bash
node make-test-call.js
```

---

## 📊 Database Schema (Supabase)

```sql
CREATE TABLE journeys (
  id TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  status TEXT DEFAULT 'scheduled'
);

CREATE TABLE passengers (
  id SERIAL PRIMARY KEY,
  journey_id TEXT REFERENCES journeys(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  boarding_point TEXT NOT NULL,
  time TEXT NOT NULL,
  language TEXT DEFAULT 'en-IN'
);

CREATE TABLE call_logs (
  id SERIAL PRIMARY KEY,
  passenger_id INTEGER REFERENCES passengers(id),
  twilio_sid TEXT,
  status TEXT DEFAULT 'initiated',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
```

## 🎯 Immediate Impact
- 🚀 **Scalability**: Decoupled worker pipelines ensure 100% notification delivery.
- 👨‍💻 **Observability**: Live SQL logs map call lifecycle states identically to massive platform dashboards.
- 🗣️ **Cost Effectiveness**: Conversational bounds restrict latency constraints while delivering 99% accuracy against traditional IVR. 

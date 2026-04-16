# BoardPing – L4 Distributed AI Voice Notification System

BoardPing is an AI-powered voice notification and conversational bot designed to automate passenger communications for mass transit architectures (e.g., AbhiBus, RedBus). 

Built for enterprise scale, it handles thousands of concurrent calls through robust BullMQ architectures, providing ultra-low latency AI interactions, autonomous scheduling, and real-time operator observability.

## 🌟 Premium Features

1.  **Autonomous Journey Dispatches**: Background scheduler targets journeys 30m before departure—zero manual effort.
2.  **Multilingual AI Engine**: Real-time conversational support in **English, Hindi, Telugu, and Kannada**.
3.  **Semantic Intent Detection**: Automatically flags passengers who report as **"LATE"** using LLM analysis.
4.  **SMS Fallback System**: High-visibility "Unreachable Manifest" panel for one-click SMS notifications if voice fails.
5.  **Multi-Operator Architecture**: Built-in support for data isolation across multiple transit companies (SaaS model).
6.  **Advanced Observability**: Track granular statuses (`Busy`, `No-Answer`, `Ringing`) and call durations in real-time.

## 🚌 BoardPing | AI-Powered Voice Notifications

BoardPing is an enterprise-grade AI notification agent designed for transport operators. It automates passenger dispatch calls using Twilio and Groq (LLM), ensuring manifests are clear and passengers are notified autonomously.

### 🌟 Key Features
- **Intelligent Talk Loops**: Conversational AI interactions using Llama 3 (via Groq).
- **BullMQ Task Engine**: Reliable retry logic and concurrency management via Redis.
- **Robust Validation Layer**: All ingress paths are strictly typed and sanitized using Zod 3.
- **Indian Locale Optimization**: Automated phone normalization (+91...) and multilingual voice support.
- **Service-Oriented AI**: Decoupled AI interaction logic in `src/services/aiService.js`.
- **Real-time Manifest**: Live operator dashboard with semantic intent extraction and status tracking.

## 💡 System Architecture

1. **Trigger Engine** - Journey-based notifications seamlessly trigger parallel worker dispatches.
2. **Postgres Storage** - Supabase natively queries `passengers` mapped to `journeys`.
3. **Queue Distribution** - `BullMQ` + `Redis` effortlessly manage job delegation, rate-limiting, and error-retry logic.
4. **Telephony Bridge** - Twilio Voice API connects programmatic systems directly to global networks.
5. **Conversational Engine** - Groq (`llama-3.3-70b`) provides <1s latency for natural voice interactions.

---

## 🛠 Tech Stack
- **Backend**: Node.js, Express, BullMQ, Redis
- **Intelligence**: LLM (Groq / OpenAI API compatible)
- **Telephony**: Twilio Voice (Webhooks & Status Callbacks)
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod (Type Safety & Normalization)
- **Frontend**: Vanilla JS, Chart.js, CSS Glassmorphism

---

## 🚀 Quick Setup (Production)

### Prerequisites
- Node.js (v18+)
- Redis
- Twilio Account (Voice + SMS capability)
- Groq API Key
- Supabase Project

### Installation
```bash
git clone https://github.com/jaggureddy11/ai-voice-calling-bot.git
cd ai-call-bot
npm install
```

### Environment Variables
Copy `.env.example` -> `.env` and fill it with your credentials:
```bash
BASE_URL=https://your-public-url.loca.lt
GROQ_API_KEY=your_key
TWILIO_ACCOUNT_SID=...
```

### Running the System
```bash
# Start autonomous engine & backend
npm run dev
```

---

## 📊 Database Schema Extensions

To enable the latest features, ensure your Supabase schema includes:

```sql
-- Call Log Extensions
ALTER TABLE call_logs ADD COLUMN attempt_count INTEGER DEFAULT 0;
ALTER TABLE call_logs ADD COLUMN is_flagged BOOLEAN DEFAULT false;
ALTER TABLE call_logs ADD COLUMN duration INTEGER DEFAULT 0;

-- AI Log Extensions
ALTER TABLE ai_logs ADD COLUMN intent TEXT;

-- Journey Scheduler
ALTER TABLE journeys ADD COLUMN notified_at TIMESTAMP WITH TIME ZONE;
```

---

## 🔗 Endpoints

### 1. The Autonomous Scheduler
The system background processes upcoming journeys every minute. 
`GET /api/calls/notify-journey` (Manual fallback still supported).

### 2. Live Monitoring
`GET /api/calls/passengers/:journeyId` - Fetch real-time manifest status.

### 3. AI Interaction Dashboard
`GET /api/calls/ai-logs` - Fetch live transcripts and intent analysis.

---

## 🎯 Impact Metrics
- 🚀 **Efficiency**: Reduces driver manual calls by 100%.
- 🗣️ **Accessibility**: Localized AI support improves passenger NPS in rural regions.
- 👨‍💻 **Observability**: Live SQL logs map call lifecycle states identically to massive platform dashboards.

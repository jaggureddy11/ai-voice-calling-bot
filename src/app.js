require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
// Helmet would be better but I'll stick to native for now to avoid dependency install wait
// app.use(require('helmet')()); 

// Start the worker to process queued jobs
require('./jobs/callWorker'); 

// Start the autonomous journey scheduler & voice cache cleanup
const { startJourneyScheduler } = require('./jobs/journeyScheduler');
const { cleanupVoiceCache } = require('./services/voiceCacheCleanup');

startJourneyScheduler();
cleanupVoiceCache(); // Initial run

const routes = require('./routes/index');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Routes
app.use('/api/calls', routes);

// Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// Global Error Handler (Production Ready)
app.use((err, req, res, next) => {
  console.error('[Global Error]:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 BoardPing Production API running on http://0.0.0.0:${port}`);
  console.log('👷 Background workers active.');
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.info('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});

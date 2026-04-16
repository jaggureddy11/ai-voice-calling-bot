require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

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
app.use(morgan('dev'));


// Routes
app.use('/api/calls', routes);

// Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'BoardPing API' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`BoardPing API is running on http://0.0.0.0:${port}`);
  console.log('Worker is listening for call jobs from Redis...');
});

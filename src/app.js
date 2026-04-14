require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Start the worker to process queued jobs
require('./jobs/callWorker'); 

const routes = require('./routes/index');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use('/api/calls', routes);

// Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'BoardPing API' });
});

app.listen(port, () => {
  console.log(`BoardPing API is running on http://localhost:${port}`);
  console.log('Worker is listening for call jobs from Redis...');
});

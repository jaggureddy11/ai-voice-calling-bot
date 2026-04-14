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

module.exports = {
  notifyJourney
};

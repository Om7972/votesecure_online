const cron = require('node-cron');
const Election = require('../models/Election');
const { logger } = require('./logger');

const checkElectionStatuses = async () => {
  try {
    const now = new Date();

    // 1. Activate published elections whose voting period has started
    const electionsToActivate = await Election.find({
      status: 'published',
      'votingPeriod.startDate': { $lte: now }
    });

    for (const election of electionsToActivate) {
      election.status = 'active';
      await election.save();
      logger.info(`Scheduler: Activated election "${election.title}" (${election._id})`);
    }

    // 2. Complete active elections whose voting period has ended
    const electionsToComplete = await Election.find({
      status: 'active',
      'votingPeriod.endDate': { $lte: now }
    });

    for (const election of electionsToComplete) {
      election.status = 'completed';
      await election.save();
      
      try {
        await election.updateResults();
        logger.info(`Scheduler: Completed election "${election.title}" (${election._id}) and computed results`);
      } catch (err) {
        logger.error(`Scheduler: Error updating results for completed election "${election.title}":`, err);
      }
    }

  } catch (error) {
    logger.error('Scheduler: Error checking election statuses:', error);
  }
};

const initializeScheduler = () => {
  logger.info('Scheduler service initialized');
  
  // Run every minute
  cron.schedule('* * * * *', () => {
    logger.debug('Running scheduled election status check...');
    checkElectionStatuses();
  });
  
  // Run an immediate check on startup
  checkElectionStatuses();
};

module.exports = {
  initializeScheduler
};

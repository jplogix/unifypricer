import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config';

// Validate configuration on startup
// try {
//   validateConfig();
// } catch (error) {
//   console.error('Configuration validation failed:', error);
//   process.exit(1);
// }

import { initializeDatabase } from './repositories/database';

// Initialize database on startup
// try {
//   initializeDatabase(config.database.path);
// } catch (error) {
//   console.error('Database initialization failed:', error);
//   process.exit(1);
// }

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

import { router as apiRouter } from './api/routes';

// API routes
app.use('/api', apiRouter);

// Serve static files from 'public' directory (where frontend build will be)
import path from 'path';
app.use(express.static(path.join(process.cwd(), 'public')));

const PORT = config.server.port;

// Initialize Scheduler
import { SchedulerService } from './services/scheduler';
import { configRepository, statusRepository, syncService } from './api/container';
import { errorHandler } from './middleware/error-handler';
import { Logger } from './utils/logger';

const logger = new Logger('Server');
const scheduler = new SchedulerService(configRepository, statusRepository, syncService);

// Apply error handler last
app.use(errorHandler);

// Handle client-side routing by serving index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(process.cwd(), 'public', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // If index.html is missing (e.g. in dev mode without build), just 404
      // or send a basic message
      res.status(404).send('Dashboard not found. Please build the frontend.');
    }
  });
});

if (require.main === module) {
  // Validate configuration on startup
  try {
    validateConfig();
  } catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
  }

  // Initialize database on startup
  try {
    initializeDatabase(config.database.path);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`Price Sync Dashboard API running on port ${PORT}`);
    logger.info(`Environment: ${config.server.nodeEnv}`);

    // Start scheduler
    scheduler.start();
  });
}

export default app;

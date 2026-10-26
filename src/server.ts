/**
 * Local / long-running entry point (npm run dev, npm start).
 * On Vercel this file is not used: the platform imports the default export
 * of src/app.ts and runs it as a serverless function.
 */
import { Server } from 'http';
import { envVars } from './app/config/env';
import app from './app';
import { connectDB, disconnectDB } from './app/config/db';

let server: Server | undefined;

const startServer = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    server = app.listen(envVars.PORT, () => {
      console.log(`Server is listening on port ${envVars.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Close the HTTP server and the DB connection, then exit.
 */
const shutdown = (signal: string, exitCode: number) => {
  console.log(`${signal} received, shutting down`);

  const finish = () => {
    disconnectDB()
      .catch(() => undefined)
      .finally(() => process.exit(exitCode));
  };

  if (server) {
    server.close(finish);
  } else {
    finish();
  }
};

startServer();

process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown('uncaughtException', 1);
});

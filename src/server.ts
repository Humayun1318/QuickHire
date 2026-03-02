import { Server } from 'http';
import { envVars } from './app/config/env';
import mongoose from 'mongoose';
import app from './app';

let server: Server;

const startServer = async () => {
  try {
    await mongoose.connect(envVars.DB_URL);

    console.log('Connected to DB!!');

    server = app.listen(envVars.PORT, () => {
      console.log(`Server is listening to port ${envVars.PORT}`);
    });
  } catch (error) {
    console.log(error);
  }
};

(async () => {
  await startServer();
})();

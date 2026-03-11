import { envVars } from './app/config/env';
import cors from 'cors';
import express, { Request, Response } from 'express';
import { globalErrorHandler } from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { router } from './app/routes';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser());
app.use(express.json());

app.use(
  cors({
    origin: envVars.FRONTEND_URL,
    credentials: true,
  }),
);

// Routes start with /api/v1
app.use('/api/v1', router);


app.use(globalErrorHandler);
app.use(notFound);

export default app;

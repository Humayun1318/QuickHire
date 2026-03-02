import { envVars } from './app/config/env';
import cors from 'cors';
import express, { Request, Response } from 'express';
// import { router } from './app/routes';
import { globalErrorHandler } from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: envVars.FRONTEND_URL,
    credentials: true,
  }),
);

app.use('/api/v1', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to QuickHire System Backend',
  });
});

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to QuickHire System Backend',
  });
});

app.use(globalErrorHandler);

app.use(notFound);

export default app;

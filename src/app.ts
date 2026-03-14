import './app/config/passport';
import { envVars } from './app/config/env';
import cors from 'cors';
import express, { Request, Response } from 'express';
import expressSession from 'express-session';
import { globalErrorHandler } from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { router } from './app/routes';
import cookieParser from 'cookie-parser';
import passport from 'passport';

const app = express();
app.use(
  expressSession({
    secret: envVars.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(passport.initialize());
app.use(passport.session());
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

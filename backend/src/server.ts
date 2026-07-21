import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { contractsRouter } from './routes/contracts.js';
import { adminRouter } from './routes/admin.js';
import { meRouter } from './routes/me.js';
import { authRouter } from './routes/auth.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true
}));
app.use(express.json({ limit: '25mb' }));
app.use(morgan('combined'));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'bridge-portal-api'
  });
});

app.use('/api/auth', authRouter);
app.use('/api/me', meRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/admin', adminRouter);

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API error:', error);
  res.status(error.status || 500).json({ error: error.message || 'Internal server error.' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.listen(config.port, () => {
  console.log(`Bridge Portal API listening on port ${config.port}`);
});

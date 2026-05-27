import express from 'express';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import commentRoutes from './routes/comments';
import assistantRoutes from './routes/assistant';
import { corsMiddleware } from './middleware/cors';
import userRoutes from './routes/users';
import { jsonBodyErrorHandler, jsonBodyParser } from './middleware/requestBody';

export const app = express();

app.use(corsMiddleware);
app.use(jsonBodyParser);
app.use(jsonBodyErrorHandler);

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/users', userRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;

import express from 'express';
import cors from 'cors';
import { env } from './env';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import commentRoutes from './routes/comments';
import { jsonBodyErrorHandler, jsonBodyParser } from './middleware/requestBody';
import assistantRoutes from './routes/assistant';

const app = express();
const PORT = env.port;

app.use(cors());
app.use(jsonBodyParser);
app.use(jsonBodyErrorHandler);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/assistant', assistantRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

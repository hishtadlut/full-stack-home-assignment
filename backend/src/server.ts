import { createServer } from 'http';
import { env } from './env';
import { app } from './app';
import { attachTaskEventServer } from './realtime/taskEvents';

const server = createServer(app);

attachTaskEventServer(server);

server.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});

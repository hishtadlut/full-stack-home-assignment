import { env } from './env';
import { app } from './app';

app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});

import { serve } from '@hono/node-server';

import { createApp } from './compose';
import { config } from './platform/config';

const app = createApp();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Morada API on http://localhost:${info.port}`);
});

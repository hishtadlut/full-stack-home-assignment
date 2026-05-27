import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  REQUEST_BODY_LIMIT_BYTES,
  REQUEST_BODY_MALFORMED_JSON_ERROR,
  REQUEST_BODY_TOO_LARGE_ERROR,
} from '../constants/requestBody';
import { jsonBodyErrorHandler, jsonBodyParser } from './requestBody';

const createTestApp = () => {
  const app = express();

  app.use(jsonBodyParser);
  app.use(jsonBodyErrorHandler);
  app.post('/echo', (req, res) => {
    res.json({ received: req.body });
  });
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'Unexpected request body parser error' });
  });

  return app;
};

describe('request body middleware', () => {
  const app = createTestApp();

  it('rejects malformed JSON bodies', async () => {
    const response = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: REQUEST_BODY_MALFORMED_JSON_ERROR });
  });

  it('rejects request bodies larger than the configured limit', async () => {
    const response = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ content: 'x'.repeat(REQUEST_BODY_LIMIT_BYTES + 1) }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: REQUEST_BODY_TOO_LARGE_ERROR });
  });

  it('accepts valid JSON bodies', async () => {
    const response = await request(app)
      .post('/echo')
      .send({ ok: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: { ok: true } });
  });
});

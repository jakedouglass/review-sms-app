import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import { z } from 'zod';
import { validateTwilioSignature } from './twilio/validateTwilioSignature.js';
import { handleTwilioVoiceStatusCallback } from './twilio/voiceStatusWebhook.js';
import { adminRouter } from './routes/admin.js';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  PUBLIC_BASE_URL: z.string().url(),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  ADMIN_API_KEY: z.string().min(1)
});

const env = envSchema.parse(process.env);

const app = express();

// Twilio sends application/x-www-form-urlencoded by default.
app.use(
  express.urlencoded({
    extended: false,
    verify: (req, _res, buf) => {
      // @ts-expect-error rawBody
      req.rawBody = buf;
    }
  })
);

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

app.post(
  '/webhooks/twilio/voice-status',
  (req, res, next) => {
    try {
      const signature = req.header('X-Twilio-Signature') ?? '';
      const url = new URL('/webhooks/twilio/voice-status', env.PUBLIC_BASE_URL).toString();
      const ok = validateTwilioSignature({
        twilioAuthToken: env.TWILIO_AUTH_TOKEN,
        signature,
        url,
        params: req.body as Record<string, string>
      });

      if (!ok) {
        return res.status(403).send('Invalid signature');
      }

      return next();
    } catch (err) {
      return next(err);
    }
  },
  handleTwilioVoiceStatusCallback
);

app.use('/admin', adminRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Listening on :${env.PORT}`);
});

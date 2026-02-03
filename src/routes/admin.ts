import express from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';

const envSchema = z.object({
  ADMIN_API_KEY: z.string().min(1)
});

const env = envSchema.parse(process.env);

export const adminRouter = express.Router();

adminRouter.use(express.json());
adminRouter.use((req, res, next) => {
  const key = req.header('x-api-key');
  if (key !== env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

adminRouter.get('/businesses', async (_req, res, next) => {
  try {
    const r = await pool.query('select * from businesses order by created_at desc');
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/businesses', async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1)
      })
      .parse(req.body);

    const r = await pool.query(
      `insert into businesses (name)
       values ($1)
       returning *`,
      [body.name]
    );

    res.status(201).json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

adminRouter.get('/phone-numbers', async (_req, res, next) => {
  try {
    const r = await pool.query('select * from phone_numbers order by created_at desc');
    res.json(r.rows);
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/phone-numbers', async (req, res, next) => {
  try {
    const body = z
      .object({
        twilio_number: z.string().min(1),
        business_id: z.string().uuid(),
        enabled: z.boolean().default(false),
        min_duration_seconds: z.number().int().positive().nullable().optional(),
        send_delay_seconds: z.number().int().nonnegative().nullable().optional()
      })
      .parse(req.body);

    const r = await pool.query(
      `insert into phone_numbers (twilio_number, business_id, enabled, min_duration_seconds, send_delay_seconds)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [
        body.twilio_number,
        body.business_id,
        body.enabled,
        body.min_duration_seconds ?? null,
        body.send_delay_seconds ?? null
      ]
    );

    res.status(201).json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

import type { RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { enqueueReviewSmsJobFromCall } from '../workers/enqueueFromCall.js';

const payloadSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  CallStatus: z.string().min(1),
  CallDuration: z.coerce.number().int().nonnegative().optional()
});

export const handleTwilioVoiceStatusCallback: RequestHandler = async (req, res, next) => {
  try {
    const payload = payloadSchema.parse(req.body);

    await pool.query(
      `insert into call_events (call_sid, from_number, to_number, call_status, call_duration_seconds, last_payload)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (call_sid) do update set
         from_number = excluded.from_number,
         to_number = excluded.to_number,
         call_status = excluded.call_status,
         call_duration_seconds = coalesce(excluded.call_duration_seconds, call_events.call_duration_seconds),
         last_payload = excluded.last_payload,
         updated_at = now()`,
      [
        payload.CallSid,
        payload.From,
        payload.To,
        payload.CallStatus,
        payload.CallDuration ?? null,
        payload
      ]
    );

    if (payload.CallStatus === 'completed') {
      await enqueueReviewSmsJobFromCall({
        callSid: payload.CallSid,
        fromNumber: payload.From,
        toNumber: payload.To,
        durationSeconds: payload.CallDuration ?? null
      });
    }

    res.status(200).send('ok');
  } catch (err) {
    next(err);
  }
};

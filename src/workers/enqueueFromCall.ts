import { pool } from '../db/pool.js';
import { computeScheduledAt } from './scheduling.js';

export async function enqueueReviewSmsJobFromCall(args: {
  callSid: string;
  fromNumber: string;
  toNumber: string;
  durationSeconds: number | null;
}): Promise<void> {
  if (args.durationSeconds == null) {
    return;
  }

  const configRes = await pool.query(
    `select
       pn.id as phone_number_id,
       pn.enabled as enabled,
       coalesce(pn.min_duration_seconds, b.default_min_duration_seconds) as min_duration_seconds,
       b.id as business_id,
       b.timezone as timezone,
       b.send_window_start_local as send_window_start_local,
       b.send_window_end_local as send_window_end_local,
       b.send_within_hours as send_within_hours,
       coalesce(pn.send_delay_seconds, b.default_send_delay_seconds) as send_delay_seconds,
       mt.body as template_body
     from phone_numbers pn
     join businesses b on b.id = pn.business_id
     left join message_templates mt on mt.business_id = b.id and mt.is_default = true
     where pn.twilio_number = $1
     limit 1`,
    [args.toNumber]
  );

  if (configRes.rowCount === 0) {
    return;
  }

  const cfg = configRes.rows[0] as {
    phone_number_id: string;
    enabled: boolean;
    min_duration_seconds: number;
    business_id: string;
    timezone: string;
    send_window_start_local: string;
    send_window_end_local: string;
    send_within_hours: number;
    send_delay_seconds: number;
    template_body: string | null;
  };

  if (!cfg.enabled) {
    return;
  }

  if (args.durationSeconds < cfg.min_duration_seconds) {
    return;
  }

  const scheduledAt = computeScheduledAt({
    timezone: cfg.timezone,
    sendWindowStartLocal: cfg.send_window_start_local,
    sendWindowEndLocal: cfg.send_window_end_local,
    sendWithinHours: cfg.send_within_hours,
    baseDelaySeconds: cfg.send_delay_seconds
  });

  if (scheduledAt == null) {
    await pool.query(
      `insert into message_jobs
        (business_id, phone_number_id, call_sid, to_number, template_body, status, suppress_reason)
       values ($1, $2, $3, $4, $5, 'SUPPRESSED', 'no_valid_send_time')
       on conflict (call_sid) do nothing`,
      [cfg.business_id, cfg.phone_number_id, args.callSid, args.fromNumber, cfg.template_body]
    );
    return;
  }

  await pool.query(
    `insert into message_jobs
      (business_id, phone_number_id, call_sid, to_number, template_body, status, scheduled_at)
     values ($1, $2, $3, $4, $5, 'QUEUED', $6)
     on conflict (call_sid) do nothing`,
    [cfg.business_id, cfg.phone_number_id, args.callSid, args.fromNumber, cfg.template_body, scheduledAt]
  );
}

import dotenv from 'dotenv';

dotenv.config();

import { pool } from './db/pool.js';
import { ezSendMessage } from './eztexting/client.js';

async function processOnce(): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const jobRes = await client.query(
      `select id, to_number, template_body
       from message_jobs
       where status = 'QUEUED'
         and scheduled_at <= now()
       order by scheduled_at asc
       limit 10
       for update skip locked`
    );

    if (jobRes.rowCount === 0) {
      await client.query('commit');
      return 0;
    }

    for (const row of jobRes.rows as Array<{ id: string; to_number: string; template_body: string | null }>) {
      const body = row.template_body ?? 'Thanks for calling! Would you leave us a quick review?';
      try {
        await ezSendMessage({ toNumberE164: row.to_number, message: body });
        await client.query(
          `update message_jobs
           set status = 'SENT', sent_at = now(), last_error = null, updated_at = now()
           where id = $1`,
          [row.id]
        );
      } catch (err) {
        await client.query(
          `update message_jobs
           set status = 'FAILED', last_error = $2, updated_at = now()
           where id = $1`,
          [row.id, err instanceof Error ? err.message : String(err)]
        );
      }
    }

    await client.query('commit');
    return jobRes.rowCount;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Worker started');

  // Simple polling loop. Replace with cron/queue later.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const count = await processOnce();
    if (count === 0) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

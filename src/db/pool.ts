import dotenv from 'dotenv';
import { Pool } from 'pg';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1)
});

const env = envSchema.parse(process.env);

export const pool = new Pool({
  connectionString: env.DATABASE_URL
});

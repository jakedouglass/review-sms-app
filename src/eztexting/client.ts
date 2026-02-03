import fetch from 'node-fetch';
import { z } from 'zod';

const envSchema = z.object({
  EZTEXTING_APP_KEY: z.string().min(1),
  EZTEXTING_APP_SECRET: z.string().min(1),
  EZTEXTING_BASE_URL: z.string().url().default('https://a.eztexting.com'),
  EZTEXTING_CREATE_MESSAGE_PATH: z.string().default('/v1/messages')
});

const env = envSchema.parse(process.env);

let cached:
  | {
      accessToken: string;
      refreshToken: string;
      expiresAtMs: number;
    }
  | undefined;

async function createToken(): Promise<{ accessToken: string; refreshToken: string; expiresInSeconds: number }> {
  const res = await fetch(`${env.EZTEXTING_BASE_URL}/v1/tokens/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ appKey: env.EZTEXTING_APP_KEY, appSecret: env.EZTEXTING_APP_SECRET })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EZTexting token create failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as unknown;
  return z
    .object({
      accessToken: z.string(),
      refreshToken: z.string(),
      expiresInSeconds: z.number()
    })
    .parse(json);
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cached && now < cached.expiresAtMs - 60_000) {
    return cached.accessToken;
  }

  const token = await createToken();
  cached = {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAtMs: now + token.expiresInSeconds * 1000
  };

  return cached.accessToken;
}

export async function ezSendMessage(args: {
  toNumberE164: string;
  message: string;
}): Promise<unknown> {
  const accessToken = await getAccessToken();

  const res = await fetch(`${env.EZTEXTING_BASE_URL}${env.EZTEXTING_CREATE_MESSAGE_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      to: args.toNumberE164,
      // Public examples for EZ Texting v1 use { to, message } on POST /v1/messages.
      // If your account requires different fields (senderId, campaignId, etc.), we can extend this.
      message: args.message
    })
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`EZTexting send failed: ${res.status} ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

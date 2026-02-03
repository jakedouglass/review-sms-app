import twilio from 'twilio';

export function validateTwilioSignature(args: {
  twilioAuthToken: string;
  signature: string;
  url: string;
  params: Record<string, string>;
}): boolean {
  return twilio.validateRequest(args.twilioAuthToken, args.signature, args.url, args.params);
}

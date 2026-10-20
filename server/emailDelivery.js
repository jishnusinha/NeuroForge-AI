// Delivery adapter: configure an authenticated service that accepts this JSON contract.
export async function deliverAccountEmail(message) {
  const endpoint = process.env.AUTH_EMAIL_WEBHOOK_URL;
  const secret = process.env.AUTH_EMAIL_WEBHOOK_SECRET;
  if (!endpoint || !secret || !process.env.PUBLIC_APP_URL) throw new Error('EMAIL_DELIVERY_UNAVAILABLE');
  if (new URL(endpoint).protocol !== 'https:' || new URL(process.env.PUBLIC_APP_URL).protocol !== 'https:') throw new Error('EMAIL_DELIVERY_REQUIRES_HTTPS');
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret }, body: JSON.stringify(message), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('EMAIL_DELIVERY_FAILED');
}

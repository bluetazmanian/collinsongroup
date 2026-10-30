// Removes what a test run created: the throwaway cognito-local accounts, their saved trips
// (fake traveller service), their emails (Mailpit) and their text messages (LocalStack SNS).
import { readFileSync } from 'node:fs';
import { AdminDeleteUserCommand, AdminGetUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

const pool = JSON.parse(readFileSync(new URL('../../.local-data/cognito.json', import.meta.url)));
const idp = new CognitoIdentityProviderClient({ endpoint: 'http://localhost:9229', region: 'eu-west-2', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } });
const made = []; // { email, phone }

/** Note an account this run created, so `cleanUp` removes it. */
export function track(email, phone = null) {
  made.push({ email, phone });
}

export async function cleanUp() {
  let removed = 0;
  for (const { email, phone } of made.splice(0)) {
    try {
      const user = await idp.send(new AdminGetUserCommand({ UserPoolId: pool.poolId, Username: email }));
      const sub = user.UserAttributes?.find((a) => a.Name === 'sub')?.Value ?? user.Username;
      await fetch(`http://localhost:4600/admin/travellers/${sub}`, { method: 'DELETE' });
      await idp.send(new AdminDeleteUserCommand({ UserPoolId: pool.poolId, Username: email }));
      removed++;
    } catch { /* already gone */ }
    await fetch(`http://localhost:8026/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`, { method: 'DELETE' }).catch(() => {});
    if (phone) await fetch(`http://localhost:4568/_aws/sns/sms-messages?region=eu-west-2&phoneNumber=${encodeURIComponent(phone)}`, { method: 'DELETE' }).catch(() => {});
  }
  return removed;
}

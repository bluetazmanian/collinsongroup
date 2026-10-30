// Upstream credentials from Secrets Manager, cached for 5 minutes. Never logged.
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

let client: SecretsManagerClient | undefined;
const cache = new Map<string, { at: number; value: string }>();

export function secretReader(secretId: string | undefined): (() => Promise<string>) | undefined {
  if (!secretId) return undefined;
  return async () => {
    const hit = cache.get(secretId);
    if (hit && Date.now() - hit.at < 300_000) return hit.value;
    client ??= new SecretsManagerClient({});
    const r = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    const value = r.SecretString ?? '';
    cache.set(secretId, { at: Date.now(), value });
    return value;
  };
}

// One command for a working local copy: start the containers, wait for them, deploy the stack,
// load the example airport and publish its first catalogue. Safe to run again.
import { execFileSync } from 'node:child_process';

const app = new URL('..', import.meta.url).pathname;
const run = (cmd, args) => execFileSync(cmd, args, { cwd: app, stdio: 'inherit' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(name, check) {
  for (let i = 0; i < 90; i++) {
    if (await check().catch(() => false)) return;
    await sleep(2000);
  }
  throw new Error(`${name} didn't start within 3 minutes`);
}

run('docker', ['compose', '-f', 'docker-compose.local.yml', '-p', 'atp', 'up', '-d', '--build']);
await waitFor('LocalStack', async () => {
  const health = await (await fetch('http://localhost:4568/_localstack/health')).json();
  return ['lambda', 'dynamodb', 'sqs', 'sns'].every((s) => ['available', 'running'].includes(health.services?.[s]));
});
await waitFor('cognito-local', async () => (await fetch('http://localhost:9229/')).status > 0);
run('node', ['scripts/local-deploy.mjs']);
run('node', ['scripts/local-seed.mjs']);
run('node', ['scripts/local-refresh.mjs']);

console.log(`
Ready.
  Web app        http://localhost:5173
  Emails         http://localhost:8026  (Mailpit)
  Logs           http://localhost:9998  (Dozzle)
  Text messages  http://localhost:4568/_aws/sns/sms-messages?region=eu-west-2
`);

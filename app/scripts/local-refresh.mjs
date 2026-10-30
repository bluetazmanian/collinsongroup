// Put a refresh job on the queue and wait for the active catalogue version to move.
import './env.mjs';
import { readFileSync } from 'node:fs';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const out = JSON.parse(readFileSync(new URL('../.local-outputs.json', import.meta.url)));
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const active = async () => (await db.send(new GetCommand({ TableName: 'AirportCatalogue', Key: { PK: 'AIRPORT#LHR', SK: 'ACTIVE' }, ConsistentRead: true }))).Item;

const before = (await active())?.version ?? 0;
const jobId = `LHR#manual-${Date.now()}`;
await new SQSClient({ useQueueUrlAsEndpoint: false }).send(new SendMessageCommand({ QueueUrl: out.RefreshQueueUrl, MessageBody: JSON.stringify({ airportId: 'LHR', jobId }) }));
console.log(`Sent ${jobId}; waiting for a new version (was ${before})...`);

const waitSeconds = Number(process.argv[2] ?? 90);
for (let i = 0; i < waitSeconds; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const a = await active();
  if (a && a.version > before) {
    console.log(`Published version ${a.version} at ${a.lastSuccessfulFetchAt}.`);
    process.exit(0);
  }
}
console.log('No new version yet.');
process.exit(1);

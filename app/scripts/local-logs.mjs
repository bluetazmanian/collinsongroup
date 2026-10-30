// Print recent log lines from a Lambda in this project's LocalStack: node scripts/local-logs.mjs refresh-catalogue [minutes]
import './env.mjs';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const fn = process.argv[2] ?? 'refresh-catalogue';
const minutes = Number(process.argv[3] ?? 15);
const r = await new CloudWatchLogsClient({}).send(new FilterLogEventsCommand({ logGroupName: `/aws/lambda/${fn}`, startTime: Date.now() - minutes * 60_000 }));
for (const e of r.events ?? []) process.stdout.write(e.message.endsWith('\n') ? e.message : e.message + '\n');

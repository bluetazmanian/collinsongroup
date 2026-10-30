// Stands in for EventBridge Scheduler, which the free LocalStack creates but never fires: every
// 15 minutes, put one refresh job per airport on the refresh queue, the same message the schedule sends.
// Runs in the atp-refresher container. A failed send (LocalStack restarting, stack not deployed yet)
// is logged and tried again on the next tick.
const ENDPOINT = process.env.SQS_ENDPOINT ?? 'http://atp-localstack:4566';
const QUEUE_URL = `${ENDPOINT}/000000000000/catalogue-refresh`;
const AIRPORTS = (process.env.AIRPORTS ?? 'LHR').split(',');
const EVERY_MINUTES = Number(process.env.EVERY_MINUTES ?? 15);

async function send(airportId) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.0',
      'x-amz-target': 'AmazonSQS.SendMessage',
      // LocalStack doesn't check signatures, but reads the region from this header.
      authorization: 'AWS4-HMAC-SHA256 Credential=test/20260101/eu-west-2/sqs/aws4_request, SignedHeaders=host, Signature=0',
    },
    body: JSON.stringify({ QueueUrl: QUEUE_URL, MessageBody: JSON.stringify({ airportId, jobId: `${airportId}#${new Date().toISOString()}` }) }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function tick() {
  for (const airportId of AIRPORTS) {
    try {
      await send(airportId);
      console.log(`${new Date().toISOString()} sent refresh job for ${airportId}`);
    } catch (err) {
      console.log(`${new Date().toISOString()} couldn't send refresh job for ${airportId}: ${err.message}`);
    }
  }
}

console.log(`Refreshing ${AIRPORTS.join(', ')} every ${EVERY_MINUTES} minutes`);
await tick();
setInterval(tick, EVERY_MINUTES * 60_000);

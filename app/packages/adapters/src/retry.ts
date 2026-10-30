// Fast retries for failed refresh jobs: 1, 2, 4, then 8 minutes, based on the SQS receive count
// (aws-deployment.md, "Retries without waiting 30 minutes").
export function retryDelaySeconds(receiveCount: number): number {
  const step = Math.min(Math.max(receiveCount, 1), 4) - 1;
  return 60 * 2 ** step;
}

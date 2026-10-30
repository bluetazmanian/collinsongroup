// CloudWatch metrics through the Embedded Metric Format: one JSON log line per metric,
// so the functions need no cloudwatch:PutMetricData permission.
export function emitMetric(name: string, value: number, unit: 'Count' | 'None' | 'Milliseconds', dimensions: Record<string, string> = {}): void {
  console.log(JSON.stringify({
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [{ Namespace: 'AirportPlanner', Dimensions: [Object.keys(dimensions)], Metrics: [{ Name: name, Unit: unit }] }],
    },
    ...dimensions,
    [name]: value,
  }));
}

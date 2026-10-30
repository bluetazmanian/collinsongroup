# Airport Trip Planner: Permissions

Exactly what each part of the system is allowed to do in AWS. Each role gets only what it needs. In the policies below, `${Account}` is the AWS account ID, and every regional resource is in `eu-west-2`. The CDK code generates these; this page is the reference to check them against.

## Who has which role

| Role | Used by | Can |
| --- | --- | --- |
| `RecommendationsRole` | Lambda `recommendations` | Read the catalogue, read one secret, write logs (metrics travel in the logs) |
| `RefreshRole` | Lambda `refresh-catalogue` | Read and write the catalogue, call Nova Micro, read two secrets, handle its queue, write logs (metrics travel in the logs) |
| `SchedulerRole` | EventBridge Scheduler | Send jobs to the refresh queue and its own dead-letter queue |
| `DeployRole` | The CI runner | Deploy the CDK stacks, nothing else |
| Browser | The web app | Nothing in AWS directly. It only calls the API with a Cognito token. |

## `RecommendationsRole`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadCatalogue",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:eu-west-2:${Account}:table/AirportCatalogue"
    },
    {
      "Sid": "ReadTravellerServiceSecret",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:eu-west-2:${Account}:secret:airport-planner/traveller-service-*"
    }
  ]
}
```

Plus the standard `AWSLambdaBasicExecutionRole` managed policy for its own log group. Custom metrics are written as CloudWatch Embedded Metric Format log lines, so no `cloudwatch:PutMetricData` permission is needed. The traveller-service secret is only needed for the [fallback](aws-deployment.md#who-the-traveller-is); with the preferred option, remove that statement. If the fallback is used, add `dynamodb:GetItem` on the link records only, using a `dynamodb:LeadingKeys` condition for `TRAVELLER#*`.

## `RefreshRole`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadWriteCatalogue",
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:BatchWriteItem"],
      "Resource": "arn:aws:dynamodb:eu-west-2:${Account}:table/AirportCatalogue"
    },
    {
      "Sid": "CallNovaMicro",
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:eu-west-2::foundation-model/amazon.nova-micro-v1:0"
    },
    {
      "Sid": "ReadUpstreamSecrets",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": [
        "arn:aws:secretsmanager:eu-west-2:${Account}:secret:airport-planner/venue-service-*",
        "arn:aws:secretsmanager:eu-west-2:${Account}:secret:airport-planner/offers-source-*"
      ]
    },
    {
      "Sid": "ConsumeRefreshQueue",
      "Effect": "Allow",
      "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ChangeMessageVisibility"],
      "Resource": "arn:aws:sqs:eu-west-2:${Account}:catalogue-refresh"
    }
  ]
}
```

Plus `AWSLambdaBasicExecutionRole`. The Converse API is authorised by `bedrock:InvokeModel`. `sqs:ChangeMessageVisibility` is what lets the worker shorten the retry wait ([Retries](aws-deployment.md#retries-without-waiting-30-minutes)). The role can't delete the table or change its settings.

## `SchedulerRole`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SendRefreshJobs",
      "Effect": "Allow",
      "Action": "sqs:SendMessage",
      "Resource": [
        "arn:aws:sqs:eu-west-2:${Account}:catalogue-refresh",
        "arn:aws:sqs:eu-west-2:${Account}:scheduler-dlq"
      ]
    }
  ]
}
```

Its trust policy allows only `scheduler.amazonaws.com`, limited to this account with an `aws:SourceAccount` condition.

## `DeployRole`

The CI runner assumes this role through GitHub OIDC (or the CI system's equivalent). No long-lived AWS keys are stored in CI. It can only assume the CDK bootstrap roles (`cdk-*-deploy-role`, `cdk-*-file-publishing-role`) in this account, and only from the main branch for production.

## Other rules

- **Queues and secrets** are encrypted with AWS-managed keys. The table uses DynamoDB's default encryption.
- **S3 bucket**: all public access blocked; the bucket policy allows `s3:GetObject` only to the CloudFront distribution, through Origin Access Control.
- **API**: no IAM access for travellers; every call goes through the Cognito authorizer.
- **Logs** never contain tokens, credentials, preferences or flight details: log the traveller's token subject hashed, plus request IDs, counts and timings.
- **Humans**: read-only access to logs and metrics for support; changes go through CI only. Production DynamoDB writes by a person need a break-glass role with an alert on use.

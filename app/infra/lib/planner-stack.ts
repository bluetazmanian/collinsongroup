// The Airport Trip Planner stack (aws-deployment.md, permissions.md).
// target "aws": the full design. target "local": the same core for LocalStack, without the
// services the free LocalStack lacks (Cognito, CloudFront, WAF, Bedrock).
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export interface PlannerStackProps extends StackProps {
  target: 'aws' | 'local';
  airports: string[];
  allowedOrigin: string;
  travellerServiceUrl: string;
  venueServiceUrl: string;
  offersSourceUrl?: string;
  /** Local only: the fake Bedrock endpoint. */
  bedrockEndpoint?: string;
  /** Local only: cognito-local's pool, which the API checks tokens against. */
  localCognito?: { jwksUrl: string; issuer: string; clientId: string };
}

export class PlannerStack extends Stack {
  constructor(scope: Construct, id: string, props: PlannerStackProps) {
    super(scope, id, props);
    const local = props.target === 'local';

    // ---- Catalogue table
    const table = new dynamodb.Table(this, 'AirportCatalogue', {
      tableName: 'AirportCatalogue',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: !local },
      removalPolicy: local ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    // ---- Queues
    const refreshDlq = new sqs.Queue(this, 'RefreshDlq', { queueName: 'catalogue-refresh-dlq', retentionPeriod: Duration.days(14) });
    const refreshQueue = new sqs.Queue(this, 'RefreshQueue', {
      queueName: 'catalogue-refresh',
      visibilityTimeout: Duration.seconds(1800),
      deadLetterQueue: { queue: refreshDlq, maxReceiveCount: 5 },
    });
    const schedulerDlq = new sqs.Queue(this, 'SchedulerDlq', { queueName: 'scheduler-dlq', retentionPeriod: Duration.days(14) });

    const bundling: nodejs.BundlingOptions = {
      externalModules: ['@aws-sdk/*'],
      target: 'node24',
      format: nodejs.OutputFormat.CJS,
      tsconfig: path.join(root, 'tsconfig.json'),
    };
    const common = {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.X86_64,
      bundling,
      depsLockFilePath: path.join(root, 'package-lock.json'),
      projectRoot: root,
    };

    // ---- recommendations
    const api = new nodejs.NodejsFunction(this, 'Recommendations', {
      ...common,
      functionName: 'recommendations',
      entry: path.join(root, 'packages/api/src/index.ts'),
      memorySize: 1024,
      timeout: Duration.seconds(10),
      reservedConcurrentExecutions: local ? undefined : 200,
      environment: {
        TABLE_NAME: table.tableName,
        TRAVELLER_SERVICE_URL: props.travellerServiceUrl,
        TRAVELLER_AUTH_MODE: 'forward-token',
        ALLOWED_ORIGIN: props.allowedOrigin,
        FRESH_MINUTES: '30',
        STALE_LIMIT_MINUTES: '240',
        POINTER_CACHE_SECONDS: '30',
        TRAVELLER_CACHE_SECONDS: '60',
        ...(local ? {
          AUTH_MODE: 'local',
          LOCAL_TEST_TOKENS: 'on',
          COGNITO_JWKS_URL: props.localCognito?.jwksUrl ?? '',
          COGNITO_ISSUER: props.localCognito?.issuer ?? '',
          COGNITO_CLIENT_ID: props.localCognito?.clientId ?? '',
        } : {}),
      },
    });
    table.grant(api, 'dynamodb:GetItem', 'dynamodb:Query'); // exactly permissions.md

    // ---- refresh-catalogue
    const refresh = new nodejs.NodejsFunction(this, 'RefreshCatalogue', {
      ...common,
      functionName: 'refresh-catalogue',
      entry: path.join(root, 'packages/refresh/src/index.ts'),
      handler: 'handler',
      memorySize: 512,
      timeout: Duration.seconds(300),
      reservedConcurrentExecutions: local ? undefined : 5,
      environment: {
        TABLE_NAME: table.tableName,
        QUEUE_URL: refreshQueue.queueUrl,
        VENUE_SERVICE_URL: props.venueServiceUrl,
        OFFERS_SOURCE_URL: props.offersSourceUrl ?? '',
        BEDROCK_MODEL_ID: 'amazon.nova-micro-v1:0',
        BEDROCK_ENDPOINT: local ? props.bedrockEndpoint ?? '' : '',
        ENRICH_PER_JOB: '200',
      },
    });
    table.grant(refresh, 'dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:BatchWriteItem');
    refresh.addEventSource(new SqsEventSource(refreshQueue, { batchSize: 1, reportBatchItemFailures: true }));
    refreshQueue.grant(refresh, 'sqs:ChangeMessageVisibility');
    refresh.addToRolePolicy(new iam.PolicyStatement({
      sid: 'CallNovaMicro',
      actions: ['bedrock:InvokeModel'],
      resources: [`arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-micro-v1:0`],
    }));

    // ---- age check, every 5 minutes
    const ageCheck = new nodejs.NodejsFunction(this, 'AgeCheck', {
      ...common,
      functionName: 'catalogue-age-check',
      entry: path.join(root, 'packages/refresh/src/index.ts'),
      handler: 'ageCheck',
      timeout: Duration.seconds(30),
      environment: { TABLE_NAME: table.tableName, AIRPORTS: props.airports.join(',') },
    });
    table.grant(ageCheck, 'dynamodb:GetItem');
    new events.Rule(this, 'AgeCheckSchedule', { schedule: events.Schedule.rate(Duration.minutes(5)), targets: [new targets.LambdaFunction(ageCheck)] });

    // ---- Scheduler: one refresh job per airport every 15 minutes
    const schedulerRole = new iam.Role(this, 'SchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com', { conditions: { StringEquals: { 'aws:SourceAccount': this.account } } }),
    });
    refreshQueue.grantSendMessages(schedulerRole);
    schedulerDlq.grantSendMessages(schedulerRole);
    for (const airportId of props.airports) {
      new scheduler.CfnSchedule(this, `Refresh${airportId}`, {
        name: `refresh-${airportId.toLowerCase()}`,
        scheduleExpression: 'rate(15 minutes)',
        flexibleTimeWindow: { mode: 'OFF' },
        target: {
          arn: refreshQueue.queueArn,
          roleArn: schedulerRole.roleArn,
          input: JSON.stringify({ airportId, jobId: `${airportId}#<aws.scheduler.scheduled-time>` }),
          retryPolicy: { maximumRetryAttempts: 3 },
          deadLetterConfig: { arn: schedulerDlq.queueArn },
        },
      });
    }

    // ---- API
    const restApi = new apigw.RestApi(this, 'PlannerApi', {
      restApiName: 'airport-trip-planner',
      endpointTypes: [apigw.EndpointType.REGIONAL],
      deployOptions: { stageName: 'prod', throttlingRateLimit: 200, throttlingBurstLimit: 400 },
      defaultCorsPreflightOptions: {
        allowOrigins: [props.allowedOrigin],
        allowMethods: ['POST'],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });
    const bodyModel = restApi.addModel('RecommendationsRequest', {
      contentType: 'application/json',
      schema: {
        schema: apigw.JsonSchemaVersion.DRAFT4,
        type: apigw.JsonSchemaType.OBJECT,
        additionalProperties: false,
        required: ['airportId'],
        properties: {
          airportId: { type: apigw.JsonSchemaType.STRING, pattern: '^[A-Z]{3}$' },
          limit: { type: apigw.JsonSchemaType.INTEGER, minimum: 1, maximum: 10 },
        },
      },
    });
    const validator = restApi.addRequestValidator('BodyValidator', { validateRequestBody: true });

    let methodOptions: apigw.MethodOptions = { requestModels: { 'application/json': bodyModel }, requestValidator: validator };
    if (!local) {
      const pool = new cognito.UserPool(this, 'Travellers', { selfSignUpEnabled: false, signInAliases: { email: true } });
      const scope = new cognito.ResourceServerScope({ scopeName: 'recommendations.read', scopeDescription: 'Read recommendations' });
      const server = pool.addResourceServer('Planner', { identifier: 'planner', scopes: [scope] });
      pool.addClient('WebApp', {
        generateSecret: false,
        oAuth: {
          flows: { authorizationCodeGrant: true },
          scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.resourceServer(server, scope)],
          callbackUrls: [props.allowedOrigin + '/'],
          logoutUrls: [props.allowedOrigin + '/'],
        },
      });
      const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'Authorizer', { cognitoUserPools: [pool] });
      methodOptions = {
        ...methodOptions,
        authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
        authorizationScopes: ['planner/recommendations.read'],
      };
    }
    restApi.root.addResource('recommendations').addMethod('POST', new apigw.LambdaIntegration(api), methodOptions);

    if (!local) {
      const acl = new wafv2.CfnWebACL(this, 'ApiWaf', {
        scope: 'REGIONAL',
        defaultAction: { allow: {} },
        visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'planner-api', sampledRequestsEnabled: true },
        rules: [{
          name: 'rate-per-ip',
          priority: 0,
          action: { block: {} },
          statement: { rateBasedStatement: { limit: 300, evaluationWindowSec: 300, aggregateKeyType: 'IP' } },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'rate-per-ip', sampledRequestsEnabled: true },
        }],
      });
      new wafv2.CfnWebACLAssociation(this, 'ApiWafAssociation', {
        resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${restApi.restApiId}/stages/${restApi.deploymentStage.stageName}`,
        webAclArn: acl.attrArn,
      });

      // Web app: private S3 behind CloudFront with a strict Content Security Policy.
      const site = new s3.Bucket(this, 'WebBucket', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true });
      const headers = new cloudfront.ResponseHeadersPolicy(this, 'WebHeaders', {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ${restApi.url} https://*.amazoncognito.com; img-src 'self' data:; frame-ancestors 'none'`,
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
          strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true },
        },
      });
      const dist = new cloudfront.Distribution(this, 'Web', {
        defaultRootObject: 'index.html',
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(site),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy: headers,
        },
      });
      new CfnOutput(this, 'WebUrl', { value: `https://${dist.distributionDomainName}` });
    }

    // ---- Alarms (aws-deployment.md, "Alarms")
    const metric = (name: string, stat: string, dims?: Record<string, string>) =>
      new cloudwatch.Metric({ namespace: 'AirportPlanner', metricName: name, statistic: stat, period: Duration.minutes(5), dimensionsMap: dims });
    for (const airportId of props.airports) {
      new cloudwatch.Alarm(this, `CatalogueAge${airportId}`, {
        alarmName: `catalogue-getting-old-${airportId}`,
        metric: metric('CatalogueAgeMinutes', 'Maximum', { AirportId: airportId }),
        threshold: 20, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      });
    }
    for (const [name, q] of [['refresh-dlq', refreshDlq], ['scheduler-dlq', schedulerDlq]] as const) {
      new cloudwatch.Alarm(this, `Dlq-${name}`, {
        alarmName: `messages-in-${name}`,
        metric: q.metricApproximateNumberOfMessagesVisible({ period: Duration.minutes(5) }),
        threshold: 0, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      });
    }
    new cloudwatch.Alarm(this, 'ApiErrors', {
      alarmName: 'api-5xx-above-2-percent',
      metric: new cloudwatch.MathExpression({
        expression: '100 * errors / MAX([requests, 1])',
        usingMetrics: { errors: restApi.metricServerError({ period: Duration.minutes(5) }), requests: restApi.metricCount({ period: Duration.minutes(5) }) },
        period: Duration.minutes(5),
      }),
      threshold: 2, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    new cloudwatch.Alarm(this, 'ApiSlow', {
      alarmName: 'api-p95-above-3-seconds',
      metric: restApi.metricLatency({ period: Duration.minutes(5), statistic: 'p95' }),
      threshold: 3000, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    new cloudwatch.Alarm(this, 'TravellerCircuit', {
      alarmName: 'traveller-service-circuit-opening',
      metric: metric('TravellerCircuitOpen', 'Sum'),
      threshold: 3, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    new cloudwatch.Alarm(this, 'LambdaThrottles', {
      alarmName: 'lambda-throttles',
      metric: new cloudwatch.MathExpression({
        expression: 'a + b',
        usingMetrics: { a: api.metricThrottles({ period: Duration.minutes(5) }), b: refresh.metricThrottles({ period: Duration.minutes(5) }) },
        period: Duration.minutes(5),
      }),
      threshold: 0, evaluationPeriods: 1, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
    new cloudwatch.Alarm(this, 'BedrockThrottling', {
      alarmName: 'bedrock-throttling-3-runs',
      metric: metric('BedrockThrottled', 'Sum'),
      threshold: 3, evaluationPeriods: 3, datapointsToAlarm: 3, comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    new CfnOutput(this, 'ApiUrl', { value: restApi.url });
    new CfnOutput(this, 'RefreshQueueUrl', { value: refreshQueue.queueUrl });
  }
}

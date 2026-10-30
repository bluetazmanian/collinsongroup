// CDK entry point. Choose the target with -c target=local|aws (default local).
import { App } from 'aws-cdk-lib';
import { PlannerStack } from '../lib/planner-stack.ts';

const app = new App();
const target = (app.node.tryGetContext('target') ?? 'local') as 'local' | 'aws';

if (target === 'local') {
  // Written by scripts/local-deploy.mjs after it sets up the pool in cognito-local.
  const poolId = app.node.tryGetContext('cognitoPoolId');
  const clientId = app.node.tryGetContext('cognitoClientId');
  new PlannerStack(app, 'AirportPlannerLocal', {
    target,
    env: { account: '000000000000', region: 'eu-west-2' },
    airports: ['LHR'],
    allowedOrigin: 'http://localhost:5173',
    // The fake services, reachable from LocalStack's Lambda containers on the atp-net network.
    travellerServiceUrl: 'http://atp-stubs:4600',
    venueServiceUrl: 'http://atp-stubs:4600',
    offersSourceUrl: 'http://atp-stubs:4600',
    bedrockEndpoint: 'http://atp-stubs:4600',
    localCognito: poolId && clientId ? {
      jwksUrl: `http://atp-cognito:9229/${poolId}/.well-known/jwks.json`,
      // cognito-local puts the address it listens on into the tokens it issues.
      issuer: `http://0.0.0.0:9229/${poolId}`,
      clientId,
    } : undefined,
  });
} else {
  const need = (k: string) => {
    const v = app.node.tryGetContext(k);
    if (!v) throw new Error(`missing context: -c ${k}=...`);
    return String(v);
  };
  new PlannerStack(app, 'AirportPlanner', {
    target,
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-2' },
    airports: need('airports').split(','),
    allowedOrigin: need('allowedOrigin'),
    travellerServiceUrl: need('travellerServiceUrl'),
    venueServiceUrl: need('venueServiceUrl'),
    offersSourceUrl: app.node.tryGetContext('offersSourceUrl'),
  });
}

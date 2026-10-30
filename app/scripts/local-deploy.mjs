// Deploy the local stack to this project's LocalStack and write the outputs the web app and tests use.
// First makes sure cognito-local has the user pool the web app signs people up to.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  CognitoIdentityProviderClient, CreateUserPoolClientCommand, CreateUserPoolCommand,
  ListUserPoolClientsCommand, ListUserPoolsCommand, UpdateUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { LOCAL_ENV } from './env.mjs';

const infra = new URL('../infra/', import.meta.url).pathname;
const run = (args) => execFileSync('npx', args, { cwd: infra, stdio: 'inherit', env: { ...process.env, ...LOCAL_ENV } });

// ---- user pool in cognito-local (kept between runs, so accounts survive a redeploy)
const cognito = new CognitoIdentityProviderClient({
  endpoint: 'http://localhost:9229', region: 'eu-west-2', credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});
const pools = (await cognito.send(new ListUserPoolsCommand({ MaxResults: 60 }))).UserPools ?? [];
const poolId = pools.find((p) => p.Name === 'airport-planner-local')?.Id
  ?? (await cognito.send(new CreateUserPoolCommand({
    PoolName: 'airport-planner-local',
    UsernameAttributes: ['email'],
    AutoVerifiedAttributes: ['email', 'phone_number'],
    Policies: { PasswordPolicy: { MinimumLength: 8, RequireLowercase: true, RequireUppercase: true, RequireNumbers: true, RequireSymbols: false } },
  }))).UserPool.Id;
// Codes go by text message to people who give a mobile number, by email to everyone else
// (Cognito's own rule when both are verified). Set on every run so older pools match.
await cognito.send(new UpdateUserPoolCommand({ UserPoolId: poolId, AutoVerifiedAttributes: ['email', 'phone_number'] }));
const clients = (await cognito.send(new ListUserPoolClientsCommand({ UserPoolId: poolId, MaxResults: 60 }))).UserPoolClients ?? [];
const clientId = clients.find((c) => c.ClientName === 'web')?.ClientId
  ?? (await cognito.send(new CreateUserPoolClientCommand({
    UserPoolId: poolId, ClientName: 'web', ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
  }))).UserPoolClient.ClientId;
mkdirSync(new URL('../.local-data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../.local-data/cognito.json', import.meta.url), JSON.stringify({ poolId, clientId }, null, 2) + '\n');
console.log(`User pool ${poolId}, web client ${clientId}`);

// ---- the stack
run(['cdklocal', 'bootstrap', 'aws://000000000000/eu-west-2']);
run(['cdklocal', 'deploy', '-c', 'target=local', '-c', `cognitoPoolId=${poolId}`, '-c', `cognitoClientId=${clientId}`,
  '--require-approval', 'never', '--outputs-file', 'cdk.out/outputs.json']);

const out = JSON.parse(readFileSync(new URL('../infra/cdk.out/outputs.json', import.meta.url))).AirportPlannerLocal;
writeFileSync(new URL('../.local-outputs.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');


const config = {
  apiUrl: out.ApiUrl.replace(/^https:/, 'http:'),
  airportId: 'LHR',
  authMode: 'local',
  cognitoEndpoint: 'http://localhost:9229',
  clientId,
  travellerUrl: 'http://localhost:4600',
};
writeFileSync(new URL('../web/config.js', import.meta.url),
  `// Written by scripts/local-deploy.mjs\nwindow.PLANNER_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
console.log('Deployed. API:', out.ApiUrl);

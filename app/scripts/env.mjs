// Settings for this project's own LocalStack (port 4568). Nothing here points at real AWS.
export const LOCAL_ENV = {
  AWS_ENDPOINT_URL: 'http://localhost:4568',
  AWS_ENDPOINT_URL_S3: 'http://s3.localhost.localstack.cloud:4568',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  AWS_REGION: 'eu-west-2',
  AWS_DEFAULT_REGION: 'eu-west-2',
  CDK_DEFAULT_ACCOUNT: '000000000000',
  CDK_DEFAULT_REGION: 'eu-west-2',
};
for (const [k, v] of Object.entries(LOCAL_ENV)) process.env[k] = v;

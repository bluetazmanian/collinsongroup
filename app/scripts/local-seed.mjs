// Load the example airport's profile into this project's LocalStack.
import './env.mjs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
await db.send(new PutCommand({
  TableName: 'AirportCatalogue',
  Item: { PK: 'AIRPORT#LHR', SK: 'PROFILE', timeZone: 'Europe/London', boardingBufferMinutes: 30, walkBufferMinutes: 15 },
}));
console.log('Seeded airport LHR.');

# Airport Trip Planner

Find somewhere to eat or shop before your flight. The app uses your preferences and flight time to suggest places, with offers when they're available.

## How to start it

You'll need **Node.js 22.18 or later** and **Docker with Compose**. Start Docker before running the commands below.

From the project folder:

```bash
cd app
npm install
npm run local:start
```

The start command launches the local services, sets up the database and loads the example airport. When it prints `Ready`, open **http://localhost:5173**.

Create an account, enter the confirmation code, then fill in **My trip** with your preferences and flight details. If you use an email address, the code appears in the local inbox below. If you add a mobile number, look in the local text-message inbox instead. No real email or text message is sent.

## Local addresses

| Service | Address |
| --- | --- |
| App | http://localhost:5173 |
| Email inbox | http://localhost:8026 |
| Text-message inbox | http://localhost:4568/_aws/sns/sms-messages?region=eu-west-2 |
| Container logs | http://localhost:9998 |

## Stopping and starting again

From `app/`, stop the services with:

```bash
npm run local:down
```

Your account and saved trip remain in `app/.local-data/`. The local AWS resources are recreated when needed, so use `npm run local:start` again after a restart.

For troubleshooting and test commands, see [Developer setup](developer-setup.md#running-locally). The [architecture overview](answer.md) explains the design, and [Documents](documents.md) lists the technical specifications.

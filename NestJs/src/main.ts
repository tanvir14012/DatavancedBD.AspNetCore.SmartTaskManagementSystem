import { createApplication } from './bootstrap.js';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const app = await createApplication();
  await app.listen(port, '0.0.0.0');
}

void main().catch(() => {
  // Configuration/connection exceptions may contain credentials; do not print them.
  console.error('Backend startup failed. Check deployment configuration.');
  process.exitCode = 1;
});

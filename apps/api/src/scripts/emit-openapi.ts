/**
 * Emit the OpenAPI document to apps/api/openapi.json. This makes the API
 * contract a committed, reviewable artifact (API-first) without needing a
 * running server or a database connection.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from '../app.js';

async function main(): Promise<void> {
  const app = await buildApp({ withDatabase: false });
  await app.ready();
  const document = app.swagger();
  const outPath = resolve(process.cwd(), 'openapi.json');
  await writeFile(outPath, JSON.stringify(document, null, 2) + '\n', 'utf8');
  await app.close();
  console.log(`Wrote OpenAPI document to ${outPath}`);
}

void main();

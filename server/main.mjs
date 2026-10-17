import { readFile } from 'node:fs/promises';
import { DeltaClient, servePlugin } from './delta-sdk.mjs';
import { createProvider } from './provider.mjs';
import * as providers from '../service/providers.mjs';
const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
await servePlugin(new DeltaClient(),manifest,await createProvider(manifest.id,providers));

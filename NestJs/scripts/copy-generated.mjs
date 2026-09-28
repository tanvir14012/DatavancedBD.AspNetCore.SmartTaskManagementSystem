import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/generated', { recursive: true });
for (const name of ['catalog', 'tenant']) {
  cpSync(`generated/${name}`, `dist/generated/${name}`, { recursive: true });
}

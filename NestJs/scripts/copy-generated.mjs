import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';

mkdirSync('dist/generated', { recursive: true });
for (const name of ['catalog', 'tenant']) {
  const sourceRoot = `generated/${name}`;
  const targetRoot = `dist/generated/${name}`;
  mkdirSync(targetRoot, { recursive: true });
  const copy = (source, target) => {
    const info = statSync(source);
    if (info.isDirectory()) {
      mkdirSync(target, { recursive: true });
      for (const child of readdirSync(source)) copy(`${source}/${child}`, `${target}/${child}`);
      return;
    }
    try {
      cpSync(source, target, { force: true });
    } catch (error) {
      // A running local API can hold Prisma's native engine open on Windows. Reuse
      // the existing engine until the owning process is stopped; other files still copy.
      if (error?.code !== 'EPERM' || !statSync(target, { throwIfNoEntry: false })) throw error;
    }
  };
  copy(sourceRoot, targetRoot);
}

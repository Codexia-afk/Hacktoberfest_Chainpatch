// Test-only build and server: the developer's .data and .next are never touched.
import { constants, cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const sandbox = mkdtempSync(path.join(tmpdir(), 'chainpatch-e2e-'));
const development = process.env.CHAINPATCH_E2E_MODE === 'development';
let child;
let stopping = false;
const env = {
  ...process.env,
  NODE_ENV: development ? 'development' : 'production',
  CHAINPATCH_DB: path.join(sandbox, 'chainpatch.sqlite'),
  OLLAMA_BASE_URL: 'http://127.0.0.1:1',
  NEXT_TELEMETRY_DISABLED: '1',
  HOSTNAME: '127.0.0.1', PORT: '3101',
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    child?.kill(signal);
  });
}

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    if (stopping) return resolve();
    child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      child = undefined;
      if (stopping || code === 0) resolve();
      else reject(new Error(`Test build/server exited with ${signal || code}`));
    });
  });
}

try {
  for (const entry of ['app', 'components', 'lib', 'public', 'package.json', 'package-lock.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts']) {
    cpSync(path.join(root, entry), path.join(sandbox, entry), { recursive: true });
  }
  const next = path.join(sandbox, 'node_modules/next/dist/bin/next');
  if (development) {
    symlinkSync(path.join(root, 'node_modules'), path.join(sandbox, 'node_modules'), 'dir');
    await run([next, 'dev', '--hostname', '127.0.0.1', '--port', '3101', '--webpack'], sandbox);
  } else {
    // Real dependency files keep standalone tracing entirely inside the sandbox.
    // Clone where supported to avoid unnecessarily copying dependency contents.
    cpSync(path.join(root, 'node_modules'), path.join(sandbox, 'node_modules'), { recursive: true, mode: constants.COPYFILE_FICLONE });
    await run([next, 'build', '--webpack'], sandbox);
    if (!stopping) {
      const standalone = path.join(sandbox, '.next/standalone');
      cpSync(path.join(sandbox, 'public'), path.join(standalone, 'public'), { recursive: true });
      cpSync(path.join(sandbox, '.next/static'), path.join(standalone, '.next/static'), { recursive: true });
      await run([path.join(standalone, 'server.js')], standalone);
    }
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  // Only our disposable test directory is removed; saved project data is preserved.
  rmSync(sandbox, { recursive: true, force: true });
}

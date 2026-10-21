import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The API builder uses its nearest package, not the web framework's install hook.
// Preserve the configured Node runtime even on hosts whose npm.cmd embeds another Node.
if (process.versions.node.split('.')[0] !== '22' || !process.env.npm_execpath) {
  throw new Error('MCP build requires Node 22 and npm script context');
}
const cwd = fileURLToPath(new URL('../', import.meta.url));
for (const args of [
  [process.env.npm_execpath, 'ci', '--include=dev'],
  [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '--noEmit', '-p', 'tsconfig.mcp-local.json'],
]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) throw new Error('MCP build dependency/type gate failed');
}

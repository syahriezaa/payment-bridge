import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const testFiles = [
  'tests/unit/signature.test.ts',
  'tests/unit/router.test.ts',
  'tests/unit/dispatcher.test.ts',
  'tests/unit/auth.test.ts',
  'tests/integration/webhook.test.ts',
  'tests/integration/admin.test.ts',
  'tests/integration/snap.test.ts'
];

console.log('Running Backend Unit & Integration Tests...');

const tsxBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
const isWindows = process.platform === 'win32';
const cmd = isWindows ? `${tsxBin}.cmd` : tsxBin;

const child = spawn(cmd, ['--test', ...testFiles], {
  stdio: 'inherit',
  shell: isWindows,
  env: {
    ...process.env,
    NODE_ENV: 'test'
  }
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ All backend unit and integration tests passed!');
  } else {
    console.error(`\n❌ Tests failed with exit code ${code}`);
    process.exit(code || 1);
  }
});

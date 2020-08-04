import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import runApp from '../src/index';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('first', async () => {
  runApp('', tmpDir);
  const data = await fs.readFile(path.join(tmpDir, 'index.html'), 'utf-8');
  expect(data).toBe('!!!');
});

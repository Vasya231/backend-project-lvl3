import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import nock from 'nock';

import runApp from '../src/index';

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('first', async () => {
  nock('https://ya.ru')
    .get('/')
    .reply(200, '!!!');
  await runApp('https://ya.ru/', tmpDir);
  const data = await fs.readFile(path.join(tmpDir, 'index.html'), 'utf-8');
  expect(data).toBe('!!!');
});

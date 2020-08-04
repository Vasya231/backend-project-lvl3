import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import nock from 'nock';

import runApp from '../src/index';

let tmpDir;

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('Should load page', async () => {
  nock('https://ya.ru')
    .get('/')
    .reply(200, '!!!');
  await runApp('https://ya.ru', tmpDir);
  const data = await fs.readFile(path.join(tmpDir, 'ya-ru.html'), 'utf-8');
  expect(data).toBe('!!!');
});

test('Should parse path', async () => {
  nock('https://ya.ru')
    .get('/test/test1')
    .reply(200, '!!!');
  await runApp('https://ya.ru/test', tmpDir);
  const data = await fs.readFile(path.join(tmpDir, 'ya-ru-test-test1.html'), 'utf-8');
  expect(data).toBe('!!!');
});

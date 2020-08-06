import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import nock from 'nock';

import runApp from '../src/index';

const pathToInputData = (filename) => `${__dirname}/fixtures/inputData/${filename}`;
const pathToExpectedData = (filename) => `${__dirname}/fixtures/expected/${filename}`;

let tmpDir;
const expectedData = {};

beforeAll(async () => {
  process.env.TEST_MODE = 'true';
  expectedData.page1 = await fs.readFile(pathToExpectedData('testhost-ru-page1.html'), 'utf-8');
  expectedData.img1 = await fs.readFile(pathToExpectedData('testhost-ru-page1_files/assets-img1.jpg'));
  expectedData.script1 = await fs.readFile(pathToExpectedData('testhost-ru-page1_files/assets-script1.js'));
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('Should save the page, download local resources and change links', async () => {
  nock('https://testhost.ru')
    .get('/page1')
    .replyWithFile(200, pathToInputData('page1.html'));
  nock('https://testhost.ru')
    .get('/assets/img1.jpg')
    .replyWithFile(200, pathToInputData('page1_files/img1.jpg'));
  nock('https://testhost.ru')
    .get('/assets/script1.js')
    .replyWithFile(200, pathToInputData('page1_files/script1.js'));
  nock('https://testhost.ru')
    .get('/assets/styles.css')
    .replyWithFile(200, pathToInputData('page1_files/styles.css'));
  await runApp('https://testhost.ru/page1', tmpDir);
  const actualData = {};
  actualData.page1 = await fs.readFile(path.join(tmpDir, 'testhost-ru-page1.html'), 'utf-8');
  actualData.img1 = await fs.readFile(path.join(tmpDir, 'testhost-ru-page1_files/assets-img1.jpg'));
  actualData.script1 = await fs.readFile(path.join(tmpDir, 'testhost-ru-page1_files/assets-script1.js'));
  expect(actualData).toEqual(expectedData);
});

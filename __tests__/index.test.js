import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import nock from 'nock';

import downloadPage from '../src/index';

const downloadPageTest = (pageUrl, outputDir) => downloadPage(pageUrl, outputDir, true);

const pathToInputData = (filename) => `${__dirname}/fixtures/inputData/${filename}`;
const pathToExpectedData = (filename) => `${__dirname}/fixtures/expected/${filename}`;

let tmpDir;
const expectedData = {};

const mockWorkingPage = (hostname, pageName = '') => {
  const pagePath = `/${pageName}`;
  nock(hostname)
    .get(pagePath)
    .replyWithFile(200, pathToInputData('page1.html'));
  nock(hostname)
    .get('/assets/img1.jpg')
    .replyWithFile(200, pathToInputData('page1_files/img1.jpg'));
  nock(hostname)
    .get('/assets/script1.js')
    .replyWithFile(200, pathToInputData('page1_files/script1.js'));
  nock(hostname)
    .get('/assets/styles.css')
    .replyWithFile(200, pathToInputData('page1_files/styles.css'));
};

beforeAll(async () => {
  expectedData.page1 = await fs.readFile(pathToExpectedData('testhost-ru-page1.html'), 'utf-8');
  expectedData.img1 = await fs.readFile(pathToExpectedData('testhost-ru-page1_files/assets-img1.jpg'));
  expectedData.script1 = await fs.readFile(pathToExpectedData('testhost-ru-page1_files/assets-script1.js'));
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

test('Positive', async () => {
  mockWorkingPage('https://testhost.ru', 'page1');
  await downloadPageTest('https://testhost.ru/page1', tmpDir);
  const actualData = {};
  actualData.page1 = await fs.readFile(path.join(tmpDir, 'testhost-ru-page1.html'), 'utf-8');
  actualData.img1 = await fs.readFile(path.join(tmpDir, 'testhost-ru-page1_files/assets-img1.jpg'));
  actualData.script1 = await fs.readFile(path.join(tmpDir, 'testhost-ru-page1_files/assets-script1.js'));
  expect(actualData).toEqual(expectedData);
});

test('Negative: Invalid directory name', async () => {
  await expect(downloadPageTest('https://testhost1.ru', {})).rejects.toThrow('Path to directory must be a string.');
});

test('Negative: Invalid page URL', async () => {
  await expect(downloadPageTest('xfdgrh', tmpDir)).rejects.toThrow('Invalid URL: xfdgrh');
});

test('Negative(http): Page does not exist', async () => {
  nock('https://testhost404')
    .get('/')
    .reply(404);
  await expect(downloadPageTest('https://testhost404', tmpDir)).rejects.toThrow('Request failed with status code 404');
});

test('Negative(http): Error with no code', async () => {
  nock('https://testhostnocode')
    .get('/')
    .replyWithError('!!!');
  await expect(downloadPageTest('https://testhostnocode', tmpDir)).rejects.toThrow('!!!');
});

test('Negative(network): no answer', async () => {
  expect.assertions(1);
  try {
    await downloadPageTest('https://169.254.0.1', tmpDir);
  } catch (e) {
    // eslint-disable-next-line jest/no-try-expect
    expect(e.message).toBe('Timeout of 3000ms exceeded.');
  }
  // await expect(downloadPage('https://169.254.0.1', tmpDir)).rejects.toThrow('Timeout of 3000ms exceeded.'); - не работает
});

test('Negative(dns): host doesn\'t exist', async () => {
  await expect(downloadPageTest('https://kjadfhkdjfh.dfjj', tmpDir)).rejects.toThrow('Failed to resolve hostname: kjadfhkdjfh.dfjj');
});

test('Negative(file system): output directory doesn\'t exist', async () => {
  mockWorkingPage('https://testhostbaddir');
  const nonexistantDirPath = path.join(tmpDir, '/whatever');
  await expect(downloadPageTest('https://testhostbaddir', nonexistantDirPath)).rejects.toThrow('Request failed with status code 404');
});

test('Negative(file system): no permission', async () => {
  mockWorkingPage('https://testhostnorights');
  await fs.chmod(tmpDir, 0);
  const expectedError = {
    errno: -13,
    message: `EACCES: permission denied mkdir '${tmpDir}/testhostnorights_files'`,
  };
  await expect(downloadPageTest('https://testhostnorights', tmpDir)).rejects.toMatchObject(expectedError);
});

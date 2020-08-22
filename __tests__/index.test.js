import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import nock from 'nock';
import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';

import { downloadPage } from '../src/index';

const downloadPageTest = (pageUrl, outputDir) => downloadPage(
  pageUrl,
  outputDir,
);

const pathToInputData = (...pathParts) => path.join(__dirname, '__fixtures__', 'inputData', ...pathParts);
const pathToExpectedData = (...pathParts) => path.join(__dirname, '__fixtures__', 'expected', ...pathParts);

let tmpDir;
const expectedData = {};

const mockWorkingPage = (hostname, pageName = '') => {
  const pagePath = `/${pageName}`;
  nock(hostname)
    .get(pagePath)
    .replyWithFile(200, pathToInputData('page1.html'));
  nock(hostname)
    .get('/assets/img1.jpg')
    .replyWithFile(200, pathToInputData('page1_files', 'img1.jpg'));
  nock(hostname)
    .get('/assets/script1.js')
    .replyWithFile(200, pathToInputData('page1_files', 'script1.js'));
  nock(hostname)
    .get('/assets/styles.css')
    .replyWithFile(200, pathToInputData('page1_files', 'styles.css'));
};

beforeAll(async () => {
  axios.defaults.adapter = nodeAdapter;
  mockWorkingPage('https://testhost.ru', 'page1');
  mockWorkingPage('https://testhostbaddir.com');
  mockWorkingPage('https://testhostnorights.com');
  mockWorkingPage('https://testhostfileexists.com');
  mockWorkingPage('https://testhostnorewrite.com');
  nock('https://testhost404.com')
    .get('/')
    .reply(404);
  nock('https://testhostnocode.com')
    .get('/')
    .replyWithError('!!!');
  expectedData.img1 = await fs.readFile(pathToExpectedData('testhost-ru-page1_files', 'assets-img1.jpg'));
  expectedData.script1 = await fs.readFile(pathToExpectedData('testhost-ru-page1_files', 'assets-script1.js'));
  expectedData.css1 = await fs.readFile(pathToExpectedData('testhost-ru-page1_files', 'assets-styles.css'));
});

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

describe('Positive testing', () => {
  const actualData = {};

  beforeAll(async () => {
    const tmpDirPositive = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
    await downloadPageTest('https://testhost.ru/page1', tmpDirPositive);
    actualData.page1 = await fs.readFile(path.join(tmpDirPositive, 'testhost-ru-page1.html'), 'utf-8');
    actualData.img1 = await fs.readFile(path.join(tmpDirPositive, 'testhost-ru-page1_files', 'assets-img1.jpg'));
    actualData.script1 = await fs.readFile(path.join(tmpDirPositive, 'testhost-ru-page1_files', 'assets-script1.js'));
    actualData.css1 = await fs.readFile(path.join(tmpDirPositive, 'testhost-ru-page1_files', 'assets-styles.css'));
  });

  test('Download, transform and save the page', () => {
    expect(actualData.page1).toMatchSnapshot();
  });

  test('Download and save local resources', () => {
    expect(actualData.img1).toEqual(expectedData.img1);
    expect(actualData.script1).toEqual(expectedData.script1);
    expect(actualData.css1).toEqual(expectedData.css1);
  });
});

describe('Negative testing: invalid arguments', () => {
  test('Invalid directory name', async () => {
    await expect(downloadPageTest('https://testhost1.ru', {})).rejects.toMatchSnapshot();
  });

  test('Invalid page URL', async () => {
    await expect(downloadPageTest('xfdgrh', tmpDir)).rejects.toThrow('Invalid URL: xfdgrh');
  });
});

describe('Negative testing: file system errors', () => {
  test('Output directory doesn\'t exist', async () => {
    const pathToResources = path.join(tmpDir, 'whatever', 'testhostbaddir-com_files');
    const expectedErrorMessage = `Cannot create directory '${pathToResources}'. Reason: no such file or directory`;
    const nonexistantDirPath = path.join(tmpDir, '/whatever');
    await expect(downloadPageTest('https://testhostbaddir.com', nonexistantDirPath)).rejects.toThrow(expectedErrorMessage);
  });

  test('No permissions', async () => {
    const pathToResources = path.join(tmpDir, 'testhostnorights-com_files');
    const expectedErrorMessage = `Cannot create directory '${pathToResources}'. Reason: permission denied`;
    await fs.chmod(tmpDir, 0);
    await expect(downloadPageTest('https://testhostnorights.com', tmpDir)).rejects.toThrow(expectedErrorMessage);
  });

  test('File already exists in place of directory', async () => {
    const existingFilePath = path.join(tmpDir, 'testhostfileexists-com_files');
    const expectedErrorMessage = `Cannot create directory '${existingFilePath}'. Reason: file already exists`;
    await fs.writeFile(existingFilePath, ' ');
    await expect(downloadPageTest('https://testhostfileexists.com', tmpDir)).rejects.toThrow(expectedErrorMessage);
  });

  test('File already exists and cant be rewritten', async () => {
    const pathToPage = path.join(tmpDir, 'testhostnorewrite-com.html');
    const expectedErrorMessage = `Cannot open file '${pathToPage}'. Reason: permission denied`;
    await fs.writeFile(pathToPage, ' ');
    await fs.chmod(pathToPage, 0);
    await expect(downloadPageTest('https://testhostnorewrite.com', tmpDir)).rejects.toThrow(expectedErrorMessage);
  });
});

describe('Negative testing: network errors', () => {
  test('Page does not exist', async () => {
    const expectedErrorMessage = 'Cannot load \'https://testhost404.com/\'. Reason: Request failed with status code 404';
    await expect(downloadPageTest('https://testhost404.com', tmpDir)).rejects.toThrow(expectedErrorMessage);
  });

  test('No answer from host', async () => {
    const expectedErrorMessage = 'Cannot load \'https://169.254.0.1/\'. Reason: Timeout of 3000ms exceeded.';
    await expect(downloadPage('https://169.254.0.1', tmpDir)).rejects.toThrow(expectedErrorMessage);
  });

  test('Host doesn\'t exist', async () => {
    const expectedErrorMessage = 'Cannot resolve hostname \'https://kjadfhkdjfh.com/\'. Reason: DNS lookup failed';
    await expect(downloadPageTest('https://kjadfhkdjfh.com', tmpDir)).rejects.toThrow(expectedErrorMessage);
  });

  test('Server replied with an error', async () => {
    const expectedErrorMessage = 'Cannot load \'https://testhostnocode.com/\'. Reason: !!!';
    await expect(downloadPageTest('https://testhostnocode.com', tmpDir)).rejects.toThrow(expectedErrorMessage);
  });
});

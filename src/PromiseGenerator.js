import { promises as fs } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import beautify from 'js-beautify';
import axios from 'axios';

import 'axios-debug-log';

import { generateLocalFileName, generateResourceDirName, getResourceFilenameGenerationFunction } from './nameGenerators';
import friendifyError from './friendifyError';
import logger from './lib/logger';

const tagLinkMap = {
  img: 'src',
  script: 'src',
  link: 'href',
};

const tags = Object.keys(tagLinkMap);

const sendGetReqWithTimeout = (url, timeout, options = {}) => {
  const abort = axios.CancelToken.source();
  const errorMessage = `Cannot load '${url}'. Reason: Timeout of ${timeout}ms exceeded.`;
  const timeoutId = setTimeout(
    () => {
      abort.cancel(errorMessage);
      logger.network(`Request ${url} was cancelled due to timeout.`);
    },
    timeout,
  );
  return axios
    .get(url, { cancelToken: abort.token, ...options })
    .catch((thrownObject) => {
      if (!axios.isCancel(thrownObject)) {
        return Promise.reject(thrownObject);
      }
      const { message } = thrownObject;
      const error = new Error(message);
      return Promise.reject(error);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });
};

const extractAndReplaceLinks = ($, pageUrl, resourceDirName) => {
  const { origin, hostname } = pageUrl;
  const resourceFilenameMap = new Map();
  const generateResourceFileName = getResourceFilenameGenerationFunction();

  const isLocal = (pathToResource) => {
    const resourceUrl = new URL(pathToResource, origin);
    return (resourceUrl.hostname === hostname);
  };

  const processTag = (tagName) => {
    logger.dom(`Processing tag: "${tagName}"`);
    const attributeWithLink = tagLinkMap[tagName];
    const elementsWithLocalLinks = $(tagName).get()
      .filter((element) => {
        logger.dom(`Checking ${$(element)}`);
        const linkToResource = $(element).attr(attributeWithLink);
        return (linkToResource && isLocal(linkToResource));
      });
    elementsWithLocalLinks.forEach((element) => {
      logger.dom(`Transforming ${$(element)}`);
      const linkToResource = $(element).attr(attributeWithLink);
      const dlLink = new URL(linkToResource, origin);
      logger.dom(`Full resource url: ${dlLink}`);
      if (!resourceFilenameMap.get(dlLink)) {
        const resourceFileName = generateResourceFileName(dlLink);
        resourceFilenameMap.set(dlLink, resourceFileName);
        logger.dom(`Generated new resource file name: ${resourceFileName}`);
      }
      const resourceFileName = resourceFilenameMap.get(dlLink);
      const newLink = path.join(resourceDirName, resourceFileName);
      $(element).attr(attributeWithLink, newLink);
    });
  };

  tags.forEach(processTag);
  return resourceFilenameMap;
};

export default class PromiseGenerator {
  constructor(pageAddress, pathToDir, config) {
    this.timeout = config.timeout;

    const fullPathToDir = path.resolve(process.cwd(), pathToDir);

    logger.main(`Parsing page address: ${pageAddress}`);
    this.pageUrl = new URL(pageAddress);
    const baseUrl = this.pageUrl.origin;
    const pageFileName = generateLocalFileName(this.pageUrl);
    this.pageFilePath = path.join(fullPathToDir, pageFileName);
    this.resourceDirName = generateResourceDirName(this.pageUrl);
    this.resourceDirPath = path.join(fullPathToDir, this.resourceDirName);

    logger.main(`Base url: ${baseUrl}`);
    logger.main(`Generated path to saved page file: ${this.pageFilePath}`);
    logger.main(`Generated path to saved resources dir: ${this.resourceDirPath}`);
  }

  renderedHtml;

  resourceFilenameMap;

  axiosGet = (url, options = {}) => sendGetReqWithTimeout(url, this.timeout, options);

  generateDownloadResourcePromise = (dlLink, filePath) => this.axiosGet(
    dlLink, { responseType: 'arraybuffer' },
  ).then(({ data }) => {
    logger.network(`${dlLink} successfully loaded.`);
    return fs.writeFile(filePath, data)
      .then(() => logger.fs(`Resource file saved, path: ${filePath}`));
  });

  loadPage = () => this.axiosGet(this.pageUrl.href)
    .then((response) => {
      logger.network('Page loaded.');
      const $ = cheerio.load(response.data);
      logger.main('Html parsed.');

      this.resourceFilenameMap = extractAndReplaceLinks($, this.pageUrl, this.resourceDirName);
      logger.main('Local resources:');
      [...this.resourceFilenameMap.entries()].forEach(([dlLink, filename]) => {
        logger.main(`${dlLink} : ${filename}`);
      });

      this.renderedHtml = beautify.html(
        $.root().html(),
        { indent_size: 2 },
      );
    });

  createResourceDir = () => fs.mkdir(this.resourceDirPath).then(() => {
    logger.fs(`Created directory ${this.resourceDirPath}`);
  });

  generateDownloadResourcesPromisesWithInfo = () => [...this.resourceFilenameMap.entries()]
    .map(([dlLink, filename]) => {
      const resourceFilePath = path.join(this.resourceDirPath, filename);
      return {
        dlLink,
        resourceFilePath,
        downloadPromise: this.generateDownloadResourcePromise(dlLink.href, resourceFilePath),
      };
    });

  savePage = () => fs.writeFile(this.pageFilePath, this.renderedHtml, 'utf-8')
    .then(() => logger.fs(`Main page file saved, path: ${this.pageFilePath}`));

  errorHandler = (error) => Promise.reject(friendifyError(error));
}

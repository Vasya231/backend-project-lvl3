import { promises as fs } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import { toPairs } from 'lodash';
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
    .catch((e) => {
      const { message } = e;
      if (!axios.isCancel(e)) {
        return Promise.reject(e);
      }
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
    const linkAttr = tagLinkMap[tagName];
    const elementsWithLocalLinks = $(tagName).get()
      .filter((element) => {
        logger.dom(`Checking ${$(element)}`);
        const linkToResource = $(element).attr(linkAttr);
        return (linkToResource && isLocal(linkToResource));
      });
    elementsWithLocalLinks.forEach((element) => {
      logger.dom(`Transforming ${$(element)}`);
      const linkToResource = $(element).attr(linkAttr);
      const dlLink = new URL(linkToResource, origin);
      logger.dom(`Full resource url: ${dlLink}`);
      if (!resourceFilenameMap.get(dlLink)) {
        const resourceFileName = generateResourceFileName(dlLink);
        resourceFilenameMap.set(dlLink, resourceFileName);
        logger.dom(`Generated new resource file name: ${resourceFileName}`);
      }
      const resourceFileName = resourceFilenameMap.get(dlLink);
      const newLink = `${resourceDirName}/${resourceFileName}`;
      $(element).attr(linkAttr, newLink);
    });
  };

  tags.forEach(processTag);
  return resourceFilenameMap;
};

export default (pageAddress, pathToDir, config) => {
  const { timeout } = config;

  const axiosGet = (url, options = {}) => sendGetReqWithTimeout(
    url, timeout, options,
  );

  const generateDownloadResourcePromise = (dlLink, filePath) => axiosGet(dlLink, {
    responseType: 'arraybuffer',
  }).then(({ data }) => {
    logger.network(`${dlLink} successfully loaded.`);
    return fs.writeFile(filePath, data)
      .then(() => logger.fs(`Resource file saved, path: ${filePath}`));
  });

  const fullPathToDir = path.resolve(process.cwd(), pathToDir);

  logger.main(`Parsing page address: ${pageAddress}`);
  const pageUrl = new URL(pageAddress);
  const baseUrl = pageUrl.origin;
  const pageFileName = generateLocalFileName(pageUrl);
  const pageFilePath = path.join(fullPathToDir, pageFileName);
  const resourceDirName = generateResourceDirName(pageUrl);
  const resourceDirPath = path.join(fullPathToDir, resourceDirName);

  logger.main(`Base url: ${baseUrl}`);
  logger.main(`Generated path to saved page file: ${pageFilePath}`);
  logger.main(`Generated path to saved resources dir: ${resourceDirPath}`);

  let resourceFilenameMap;
  let $;
  let renderedHtml;

  logger.network('Start loading the page.');
  const allPromises = {};

  allPromises.loadPage = () => axiosGet(pageUrl.href)
    .then((response) => {
      logger.network('Page loaded.');
      $ = cheerio.load(response.data);
      logger.main('Html parsed.');

      resourceFilenameMap = extractAndReplaceLinks($, pageUrl, resourceDirName);
      logger.main('Local resources:');
      toPairs(resourceFilenameMap).forEach(([dlLink, filename]) => {
        logger.main(`${dlLink} : ${filename}`);
      });

      renderedHtml = beautify.html(
        $.root().html(),
        { indent_size: 2 },
      );
    });

  allPromises.getDownloadResourcesPromisesWithURLs = () => toPairs(resourceFilenameMap)
    .map(([dlLink, filename]) => {
      const resourceFilePath = path.join(resourceDirPath, filename);
      return {
        dlLink,
        resourceFilePath,
        downloadPromise: generateDownloadResourcePromise(dlLink.href, resourceFilePath),
      };
    });

  allPromises.createResourceDir = () => fs.mkdir(resourceDirPath).then(() => {
    logger.fs(`Created directory ${resourceDirPath}`);
  });

  allPromises.savePage = () => fs.writeFile(pageFilePath, renderedHtml, 'utf-8')
    .then(() => logger.fs(`Main page file saved, path: ${pageFilePath}`));

  allPromises.errorHandler = (e) => Promise.reject(friendifyError(e));

  return allPromises;
};

import * as yup from 'yup';
import axios from 'axios';
import path from 'path';
import cheerio from 'cheerio';
import beautify from 'js-beautify';
import { promises as fs } from 'fs';
import Listr from 'listr';

import 'axios-debug-log';

import logger from './lib/logger';
import { generateLocalPaths, getResourceFilenameGenerationFunction } from './nameGenerators';
import friendifyError from './friendifyError';

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

const argumentsValidationSchema = yup.object().shape({
  pageAddress: yup.string().required().url((obj) => `Invalid URL: ${obj.value}`),
  pathToDir: yup.string(),
  timeout: yup.number().integer('Timeout must be integer').min(0, 'Timeout must be positive'),
});

const validateArguments = (pageAddress, pathToDir, timeout) => {
  logger.main('Validating arguments.');
  argumentsValidationSchema.validateSync({
    pageAddress, pathToDir, timeout,
  }, { strict: true });
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
      const dlLinkString = dlLink.href;
      logger.dom(`Full resource url: ${dlLink}`);
      if (!resourceFilenameMap.get(dlLinkString)) {
        const resourceFileName = generateResourceFileName(dlLink);
        resourceFilenameMap.set(dlLinkString, resourceFileName);
        logger.dom(`Generated new resource file name: ${resourceFileName}`);
      }
      const resourceFileName = resourceFilenameMap.get(dlLinkString);
      const newLink = path.join(resourceDirName, resourceFileName);
      $(element).attr(attributeWithLink, newLink);
    });
  };

  tags.forEach(processTag);
  return resourceFilenameMap;
};

const transformError = (error) => Promise.reject(friendifyError(error));

export default (pageAddress, pathToDir, timeout = 3000) => {
  try {
    validateArguments(pageAddress, pathToDir, timeout);
  } catch (error) {
    return Promise.reject(error);
  }
  logger.main('Arguments validated');

  const pageUrl = new URL(pageAddress);
  const { pageFilePath, resourceDirName, resourceDirPath } = generateLocalPaths(pageUrl, pathToDir);
  logger.main(`Generated path to saved page file: ${pageFilePath}`);
  logger.main(`Generated path to saved resources dir: ${resourceDirPath}`);

  const axiosGet = (url, options = {}) => sendGetReqWithTimeout(url, timeout, options);

  const generateDownloadResourcePromise = (dlLink, filePath) => axiosGet(
    dlLink, { responseType: 'arraybuffer' },
  ).then(({ data }) => {
    logger.network(`${dlLink} successfully loaded.`);
    return fs.writeFile(filePath, data)
      .then(() => logger.fs(`Resource file saved, path: ${filePath}`));
  });

  let resourceFilenameMap;
  let renderedHtml;

  return axiosGet(pageUrl.href)
    .then((response) => {
      logger.network('Page loaded.');
      const $ = cheerio.load(response.data);
      logger.main('Html parsed.');

      resourceFilenameMap = extractAndReplaceLinks($, pageUrl, resourceDirName);
      logger.main('Local resources:');
      resourceFilenameMap.forEach((dlLink, filename) => {
        logger.main(`${dlLink} : ${filename}`);
      });

      renderedHtml = beautify.html(
        $.root().html(),
        { indent_size: 2 },
      );
    })
    .then(() => fs.mkdir(resourceDirPath))
    .then(() => {
      logger.fs(`Created directory ${resourceDirPath}`);
      return fs.writeFile(pageFilePath, renderedHtml, 'utf-8');
    })
    .then(() => {
      logger.fs(`Saved page ${pageFilePath}`);
      const tasks = [...resourceFilenameMap]
        .map(([dlLink, filename]) => {
          const resourceFilePath = path.join(resourceDirPath, filename);
          return {
            title: `Downloading ${dlLink} to ${resourceFilePath}`,
            task: () => generateDownloadResourcePromise(dlLink, resourceFilePath)
              .catch(transformError),
          };
        });
      return (new Listr(tasks, { concurrent: true, exitOnError: false })).run();
    })
    .catch(transformError);
};

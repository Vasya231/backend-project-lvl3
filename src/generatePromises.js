import { promises as fs } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import { uniq, keyBy } from 'lodash';
import beautify from 'js-beautify';
import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';

import 'axios-debug-log';

import { generateLocalFileName, generateResourceDirName, getResourceFilenameGenerationFunction } from './nameGenerators';
import friendifyError from './friendifyError';
import logger from './lib/logger';

const tagLinkMap = {
  img: 'src',
  script: 'src',
  link: 'href',
};

const getWithManualTimeout = (url, instance, timeout, options = {}) => {
  const abort = axios.CancelToken.source();
  const errorMessage = `Cannot load '${url}'. Reason: Timeout of ${timeout}ms exceeded.`;
  const timeoutId = setTimeout(
    () => {
      abort.cancel(errorMessage);
      logger.network(`Request ${url} was cancelled due to timeout.`);
    },
    timeout,
  );
  return instance
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

const getLocalResourcesPaths = ($, pageUrl) => {
  const isLocal = (pathToResource) => {
    const { origin, hostname } = pageUrl;
    const resourceUrl = new URL(pathToResource, origin);
    return (resourceUrl.hostname === hostname);
  };

  const getResourcesPathsFromTag = (tagName) => {
    logger.dom(`Extracting resource path from ${tagName} elements.`);
    const linkAttr = tagLinkMap[tagName];
    const links = $(tagName).map((i, element) => $(element).attr(linkAttr)).get();
    return links.filter((resourcePath) => (resourcePath !== undefined));
  };

  const tags = Object.keys(tagLinkMap);
  logger.dom(`Extracting links to local resources from tags: ${tags}`);
  const resourcePaths = tags.reduce(
    (acc, tagName) => [...acc, ...getResourcesPathsFromTag(tagName)],
    [],
  );
  const uniqueResourcePaths = uniq(resourcePaths);
  return uniqueResourcePaths.filter(isLocal);
};

const transformLinks = ($, resourceMap) => {
  const transformLinksInTag = (tagName) => {
    logger.dom(`Transforming ${tagName} elements.`);
    const linkAttr = tagLinkMap[tagName];
    $(tagName).each((i, element) => {
      const resourcePath = $(element).attr(linkAttr);
      if (!resourcePath) {
        return;
      }
      const resourceProps = resourceMap[resourcePath];
      if (!resourceProps) {
        return;
      }
      const { newLink } = resourceProps;
      logger.dom(`Transformed ${cheerio.html($(element))}`);
      $(element).attr(linkAttr, newLink);
    });
  };

  const tags = Object.keys(tagLinkMap);
  logger.dom(`Transforming links to resources in tags: ${tags}`);
  tags.forEach(
    (tagName) => transformLinksInTag(tagName),
  );
};

const generateResourceMap = (resourcePaths, resourceDirName, pageUrl) => {
  const { origin } = pageUrl;
  const generateResourceFileName = getResourceFilenameGenerationFunction();
  const resourceProps = resourcePaths.map((resourcePath) => {
    const dlLink = new URL(resourcePath, origin);
    const resourceFileName = generateResourceFileName(dlLink);
    const newLink = `${resourceDirName}/${resourceFileName}`;
    return {
      resourcePath,
      dlLink,
      newLink,
      resourceFileName,
    };
  });
  return keyBy(resourceProps, ({ resourcePath }) => resourcePath);
};

export default (pageAddress, pathToDir, config) => {
  const { timeout, testMode } = config;

  const axiosInstance = testMode ? axios.create({ adapter: nodeAdapter }) : axios.create();

  const axiosGet = (url, options = {}) => getWithManualTimeout(
    url, axiosInstance, timeout, options,
  );

  const generateLoadResourcePromise = (resourceProps) => {
    const { dlLink } = resourceProps;
    return axiosGet(dlLink.href, {
      responseType: 'arraybuffer',
    }).then(({ data }) => {
      // eslint-disable-next-line no-param-reassign
      resourceProps.data = data;
      logger.network(`${dlLink} successfully loaded.`);
      return true;
    });
  };

  const fullPathToDir = path.resolve(process.cwd(), pathToDir);

  if (config.testMode) {
    axios.defaults.adapter = nodeAdapter;
  }

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

  let localResourceMap;
  let $;
  let renderedHtml;

  logger.network('Start loading the page.');
  const allPromises = {};

  allPromises.loadPage = () => axiosGet(pageUrl.href)
    .then((response) => {
      logger.network('Page loaded.');
      $ = cheerio.load(response.data);
      logger.main('Html parsed.');

      const uniqueLocalResourcePaths = getLocalResourcesPaths($, pageUrl);
      logger.main(`Extracted paths to local resources: ${uniqueLocalResourcePaths}`);

      localResourceMap = generateResourceMap(uniqueLocalResourcePaths, resourceDirName, pageUrl);
      const renderedLocalResourceMap = JSON.stringify(localResourceMap, null, 2);
      logger.main(`Generated local resources props: ${renderedLocalResourceMap}`);

      transformLinks($, localResourceMap);

      renderedHtml = beautify.html(
        $.root().html(),
        { indent_size: 2 },
      );
    });

  allPromises.getLoadResourcesPromisesWithURLs = () => Object.values(localResourceMap)
    .map((resourceProps) => ({
      dlLink: resourceProps.dlLink,
      loadPromise: generateLoadResourcePromise(resourceProps),
    }));

  allPromises.createResourceDir = () => fs.mkdir(resourceDirPath).then(() => {
    logger.fs(`Created directory ${resourceDirPath}`);
  });

  allPromises.savePage = () => fs.writeFile(pageFilePath, renderedHtml, 'utf-8')
    .then(() => logger.fs(`Main page file saved, path: ${pageFilePath}`));

  allPromises.getSaveResourcesPromisesWithPaths = () => Object.values(localResourceMap).map(
    ({ resourceFileName, data }) => {
      const resourceFilePath = path.join(resourceDirPath, resourceFileName);
      return {
        savePromise: fs.writeFile(resourceFilePath, data)
          .then(() => logger.fs(`Resource file saved, path: ${resourceFilePath}`)),
        filePath: resourceFilePath,
      };
    },
  );

  allPromises.errorHandler = (e) => Promise.reject(friendifyError(e));

  return allPromises;
};

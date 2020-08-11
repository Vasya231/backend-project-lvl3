import { promises as fs } from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import { uniq, keyBy } from 'lodash';
import beautify from 'js-beautify';
import debug from 'debug';

import 'axios-debug-log';

import axios, { CancelToken } from './lib/axios';
import { generateLocalFileName, generateResourceDirName, getResourceFilenameGenerationFunction } from './nameGenerators';

const tagProps = {
  img: {
    tagName: 'img',
    linkAttr: 'src',
  },
  script: {
    tagName: 'script',
    linkAttr: 'src',
  },
  link: {
    tagName: 'link',
    linkAttr: 'href',
  },
};

const logMain = debug('page-loader');
const logDom = debug('page-loader.dom');
const logFs = debug('page-loader.file-system');
const logNetwork = debug('page-loader.network');

const config = { timeout: 3000 };

const axiosGet = (url, options = {}) => {
  const abort = CancelToken.source();
  const timeoutId = setTimeout(
    () => {
      abort.cancel(`Timeout of ${config.timeout}ms exceeded.`);
      logNetwork(`Request ${url} was cancelled due to timeout.`);
    },
    config.timeout,
  );
  return axios
    .get(url, { cancelToken: abort.token, ...options })
    .then((response) => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch((e) => {
      if (e.message !== `Timeout of ${config.timeout}ms exceeded.`) {
        clearTimeout(timeoutId);
      }
      return Promise.reject(e);
    });
};

const getLocalResourcesPaths = ($, pageUrl) => {
  const isLocal = (pathToResource) => {
    const { origin, hostname } = pageUrl;
    const resourceUrl = new URL(pathToResource, origin);
    return (resourceUrl.hostname === hostname);
  };

  const getResourcesPathsFromTag = (tagName) => {
    logDom(`Extracting resource path from ${tagName} elements.`);
    const { linkAttr } = tagProps[tagName];
    const links = $(tagName).map((i, element) => $(element).attr(linkAttr)).get();
    return links.filter((resourcePath) => (resourcePath !== undefined));
  };

  const tags = Object.keys(tagProps);
  logDom(`Extracting links to local resources from tags: ${tags}`);
  const resourcePaths = tags.reduce(
    (acc, tagName) => [...acc, ...getResourcesPathsFromTag(tagName)],
    [],
  );
  const uniqueResourcePaths = uniq(resourcePaths);
  return uniqueResourcePaths.filter(isLocal);
};

const transformLinks = ($, resourceMap) => {
  const transformLinksInTag = (tagName) => {
    logDom(`Transforming ${tagName} elements.`);
    const { linkAttr } = tagProps[tagName];
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
      logDom(`Transformed ${cheerio.html($(element))}`);
      $(element).attr(linkAttr, newLink);
    });
  };

  const tags = Object.keys(tagProps);
  logDom(`Transforming links to resources in tags: ${tags}`);
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

const generateLoadResourcePromise = (resourceProps) => {
  const { dlLink } = resourceProps;
  return axiosGet(dlLink.href, {
    responseType: 'arraybuffer',
  }).then(({ data }) => {
    // eslint-disable-next-line no-param-reassign
    resourceProps.data = data;
    logNetwork(`${dlLink} successfully loaded.`);
    return true;
  });
};

export default (pageAddress, pathToDir) => {
  logMain('Validating arguments.');
  if (typeof pathToDir !== 'string') {
    return Promise.reject(new Error('Path to directory must be a string.'));
  }
  try {
    // eslint-disable-next-line no-new
    new URL(pageAddress);
  } catch (e) {
    return Promise.reject(e);
  }

  logMain(`Parsing page address: ${pageAddress}`);
  const pageUrl = new URL(pageAddress);
  const baseUrl = pageUrl.origin;
  const pageFileName = generateLocalFileName(pageUrl);
  const pageFilePath = path.join(pathToDir, pageFileName);
  const resourceDirName = generateResourceDirName(pageUrl);
  const resourceDirPath = path.join(pathToDir, resourceDirName);

  logMain(`Base url: ${baseUrl}`);
  logMain(`Generated path to saved page file: ${pageFilePath}`);
  logMain(`Generated path to saved resources dir: ${resourceDirPath}`);

  let localResourceMap;
  let $;

  logNetwork('Start loading the page.');
  return axiosGet(pageUrl.href)
    .then((response) => {
      logNetwork('Page loaded.');
      $ = cheerio.load(response.data);
      logMain('Html parsed.');

      const uniqueLocalResourcePaths = getLocalResourcesPaths($, pageUrl);
      logMain(`Extracted paths to local resources: ${uniqueLocalResourcePaths}`);

      localResourceMap = generateResourceMap(uniqueLocalResourcePaths, resourceDirName, pageUrl);
      const renderedLocalResourceMap = JSON.stringify(localResourceMap, null, 2);
      logMain(`Generated local resources props: ${renderedLocalResourceMap}`);

      transformLinks($, localResourceMap);

      logNetwork('Downloading resources.');
      return Promise.all(Object.values(localResourceMap).map(generateLoadResourcePromise));
    })
    .then(() => {
      logFs(`Creating directory ${resourceDirPath}`);
      return fs.mkdir(resourceDirPath);
    })
    .then(() => {
      const renderedHtml = beautify.html(
        $.root().html(),
        { indent_size: 2 },
      );
      logMain('Generated modified page html.');
      const savePagePromise = fs.writeFile(pageFilePath, renderedHtml, 'utf-8')
        .then(() => logFs(`Main page file saved, path: ${pageFilePath}`));
      const saveResourcePromises = Object.values(localResourceMap).map(
        ({ resourceFileName, data }) => {
          const resourceFilePath = path.join(resourceDirPath, resourceFileName);
          return fs.writeFile(resourceFilePath, data)
            .then(() => logFs(`Resource file saved, path: ${resourceFilePath}`));
        },
      );
      return Promise.all([savePagePromise, ...saveResourcePromises]);
    });
};

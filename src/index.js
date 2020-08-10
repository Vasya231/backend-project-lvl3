import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';
import cheerio from 'cheerio';
import { uniq, keyBy } from 'lodash';
import beautify from 'js-beautify';
import debug from 'debug';

import 'axios-debug-log';

import { generateLocalFileName, generateResourceDirName, getResourceFilenameGenerationFunction } from './utils';

const tags = {
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

export default (urlString, pathToDir) => {
  const testMode = process.env.TEST_MODE;
  if (testMode === 'true') {
    axios.defaults.adapter = nodeAdapter;
  }
  const writeLog = debug('page-loader');

  const generateResourceFileName = getResourceFilenameGenerationFunction();

  writeLog(`Parsing page address: ${urlString}`);
  const url = new URL(urlString);
  const baseUrl = url.origin;
  const pageFileName = generateLocalFileName(url);
  const pageFilePath = path.join(pathToDir, pageFileName);
  const resourceDirName = generateResourceDirName(url);
  const resourceDirPath = path.join(pathToDir, resourceDirName);

  writeLog(`Base url: ${baseUrl}`);
  writeLog(`Generated path to saved page file: ${pageFilePath}`);
  writeLog(`Generated path to saved resources dir: ${resourceDirPath}`);

  let localResourceMap;
  let $;

  const isLocal = (pathToResource) => {
    const fullUrl = new URL(pathToResource, baseUrl);
    return (fullUrl.hostname === url.hostname);
  };

  const transformLinks = (tagName, resourceMap, logger = () => {}) => {
    const { linkAttr } = tags[tagName];
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
      logger(`Transformed ${cheerio.html($(element))}`);
      $(element).attr(linkAttr, newLink);
    });
  };

  const getResourcePaths = (tagName) => {
    const { linkAttr } = tags[tagName];
    const links = $(tagName).map((i, element) => $(element).attr(linkAttr)).get();
    return links.filter((resourcePath) => (resourcePath !== undefined));
  };

  const generateResourceMap = (resourcePaths) => {
    const resourceProps = resourcePaths.map((resourcePath) => {
      const dlLink = new URL(resourcePath, baseUrl);
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

  writeLog('Starting to download the page.');
  return axios.get(url.href)
    .then((response) => {
      writeLog('Page loaded, parsing html.');
      $ = cheerio.load(response.data);
      writeLog('Html parsed, extracting paths to resources.');
      const resourcePaths = Object.keys(tags).reduce(
        (acc, tagName) => [...acc, ...getResourcePaths(tagName)],
        [],
      );
      const uniqueResourcePaths = uniq(resourcePaths);
      const uniqueLocalResourcePaths = uniqueResourcePaths.filter(isLocal);
      writeLog(`Extracted paths to local resources: ${uniqueLocalResourcePaths}`);

      localResourceMap = generateResourceMap(uniqueLocalResourcePaths);
      const renderedLocalResourceMap = JSON.stringify(localResourceMap, null, 2);
      writeLog(`Generated local resources props: ${renderedLocalResourceMap}`);

      writeLog('Transforming links to local resources.');
      const transformLinksLogger = debug('page-loader.transform');
      Object.keys(tags).forEach(
        (tagName) => transformLinks(tagName, localResourceMap, transformLinksLogger),
      );

      writeLog('Downloading resources.');
      const generateLoadResourcePromise = (resourceProps) => {
        const { dlLink } = resourceProps;
        return axios.get(dlLink.href, {
          responseType: 'arraybuffer',
        }).then(({ data }) => {
          // eslint-disable-next-line no-param-reassign
          resourceProps.data = data;
          writeLog(`${dlLink} successfully loaded.`);
          return true;
        });
      };
      return Promise.all(Object.values(localResourceMap).map(generateLoadResourcePromise));
    })
    .then(() => {
      fs.mkdir(resourceDirPath);
      writeLog(`Created directory ${resourceDirPath}`);
    })
    .then(() => {
      const renderedHtml = beautify.html(
        $.root().html(),
        { indent_size: 2 },
      );
      writeLog('Generated modified page html.');
      const savePagePromise = fs.writeFile(pageFilePath, renderedHtml, 'utf-8')
        .then(() => writeLog(`Main page file saved, path: ${pageFilePath}`));
      const saveResourcePromises = Object.values(localResourceMap).map(
        ({ resourceFileName, data }) => {
          const resourceFilePath = path.join(resourceDirPath, resourceFileName);
          return fs.writeFile(resourceFilePath, data)
            .then(() => writeLog(`Resource file saved, path: ${resourceFilePath}`));
        },
      );
      return Promise.all([savePagePromise, ...saveResourcePromises]);
    });
};

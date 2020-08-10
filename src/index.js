import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';
import cheerio from 'cheerio';
import { uniq, keyBy } from 'lodash';
import beautify from 'js-beautify';
import debug from 'debug';

import 'axios-debug-log';

import { generateLocalFileName, generateResourceDirName, getResourceFilenameGenerationFunction } from './nameGenerators';

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

const logMain = debug('page-loader');
const logDom = debug('page-loader.dom');

export default (pageAddress, pathToDir) => {
  const testMode = process.env.TEST_MODE;
  if (testMode === 'true') {
    axios.defaults.adapter = nodeAdapter;
  }

  const generateResourceFileName = getResourceFilenameGenerationFunction();

  logMain(`Parsing page address: ${pageAddress}`);
  try {
    // eslint-disable-next-line no-new
    new URL(pageAddress);
  } catch (e) {
    return Promise.reject(e);
  }
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

  const isLocal = (pathToResource) => {
    const fullUrl = new URL(pathToResource, baseUrl);
    return (fullUrl.hostname === pageUrl.hostname);
  };

  const transformLinks = (tagName, resourceMap) => {
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
      logDom(`Transformed ${cheerio.html($(element))}`);
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

  const generateLoadResourcePromise = (resourceProps) => {
    const { dlLink } = resourceProps;
    return axios.get(dlLink.href, {
      responseType: 'arraybuffer',
    }).then(({ data }) => {
      // eslint-disable-next-line no-param-reassign
      resourceProps.data = data;
      logMain(`${dlLink} successfully loaded.`);
      return true;
    });
  };

  logMain('Starting to download the page.');
  return axios.get(pageUrl.href)
    .then((response) => {
      logMain('Page loaded, parsing html.');
      $ = cheerio.load(response.data);
      logMain('Html parsed, extracting paths to resources.');
      const resourcePaths = Object.keys(tags).reduce(
        (acc, tagName) => [...acc, ...getResourcePaths(tagName)],
        [],
      );
      const uniqueResourcePaths = uniq(resourcePaths);
      const uniqueLocalResourcePaths = uniqueResourcePaths.filter(isLocal);
      logMain(`Extracted paths to local resources: ${uniqueLocalResourcePaths}`);

      localResourceMap = generateResourceMap(uniqueLocalResourcePaths);
      const renderedLocalResourceMap = JSON.stringify(localResourceMap, null, 2);
      logMain(`Generated local resources props: ${renderedLocalResourceMap}`);

      logMain('Transforming links to local resources.');
      Object.keys(tags).forEach(
        (tagName) => transformLinks(tagName, localResourceMap),
      );

      logMain('Downloading resources.');
      return Promise.all(Object.values(localResourceMap).map(generateLoadResourcePromise));
    })
    .then(() => {
      logMain(`Creating directory ${resourceDirPath}`);
      return fs.mkdir(resourceDirPath);
    })
    .then(() => {
      const renderedHtml = beautify.html(
        $.root().html(),
        { indent_size: 2 },
      );
      logMain('Generated modified page html.');
      const savePagePromise = fs.writeFile(pageFilePath, renderedHtml, 'utf-8')
        .then(() => logMain(`Main page file saved, path: ${pageFilePath}`));
      const saveResourcePromises = Object.values(localResourceMap).map(
        ({ resourceFileName, data }) => {
          const resourceFilePath = path.join(resourceDirPath, resourceFileName);
          return fs.writeFile(resourceFilePath, data)
            .then(() => logMain(`Resource file saved, path: ${resourceFilePath}`));
        },
      );
      return Promise.all([savePagePromise, ...saveResourcePromises]);
    });
};

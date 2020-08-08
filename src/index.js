import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';
import cheerio from 'cheerio';
import { uniq, keyBy } from 'lodash';
import beautify from 'js-beautify';

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

  const generateResourceFileName = getResourceFilenameGenerationFunction();

  const url = new URL(urlString);
  const baseUrl = url.origin;
  const pageFileName = generateLocalFileName(url);
  const pageFilePath = path.join(pathToDir, pageFileName);
  const resourceDirName = generateResourceDirName(url);
  const resourceDirPath = path.join(pathToDir, resourceDirName);

  console.log(pageFilePath);
  console.log(resourceDirPath);

  let localResourceMap;
  let $;

  const isLocal = (pathToResource) => {
    const fullUrl = new URL(pathToResource, baseUrl);
    return (fullUrl.hostname === url.hostname);
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

  return axios.get(url.href)
    .then((response) => {
      $ = cheerio.load(response.data);
      const resourcePaths = Object.keys(tags).reduce(
        (acc, tagName) => [...acc, ...getResourcePaths(tagName)],
        [],
      );
      const uniqueResourcePaths = uniq(resourcePaths);
      const uniqueLocalResourcePaths = uniqueResourcePaths.filter(isLocal);
      console.log(uniqueLocalResourcePaths);

      localResourceMap = generateResourceMap(uniqueLocalResourcePaths);
      console.log(localResourceMap);

      Object.keys(tags).forEach((tagName) => transformLinks(tagName, localResourceMap));

      const loadResource = (resourceProps) => {
        const { dlLink } = resourceProps;
        return axios.get(dlLink.href, {
          responseType: 'arraybuffer',
        }).then(({ data }) => {
          // eslint-disable-next-line no-param-reassign
          resourceProps.data = data;
          return true;
        });
      };
      return Promise.all(Object.values(localResourceMap).map(loadResource));
    })
    .then(() => fs.mkdir(resourceDirPath))
    .then(() => {
      const renderedHtml = beautify.html(
        $.root().html(),
        { indent_size: 2 },
      );
      const savePagePromise = fs.writeFile(pageFilePath, renderedHtml, 'utf-8');
      const saveResourcePromises = Object.values(localResourceMap).map(
        ({ resourceFileName, data }) => fs.writeFile(
          path.join(resourceDirPath, resourceFileName),
          data,
        ),
      );
      return Promise.all([savePagePromise, ...saveResourcePromises]);
    });
};

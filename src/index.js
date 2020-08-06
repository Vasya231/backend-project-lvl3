import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';
import cheerio from 'cheerio';
import { uniq } from 'lodash';

import { generateLocalFileName, generateResourceDirName, generateResourceFileName } from './utils';

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

const getResourcePaths = ($, tagName) => {
  const { linkAttr } = tags[tagName];
  const links = $(tagName).map((i, element) => $(element).attr(linkAttr)).get();
  return links.filter((resourcePath) => (resourcePath !== undefined));
};

export default (urlString, pathToDir) => {
  const testMode = process.env.TEST_MODE;
  if (testMode === 'true') {
    axios.defaults.adapter = nodeAdapter;
  }

  const url = new URL(urlString);
  const baseUrl = url.origin;
  const pageFileName = generateLocalFileName(url);
  const pageFilePath = path.join(pageFileName, pathToDir);
  const resourceDirName = generateResourceDirName(url);
  const resourceDirPath = path.join(resourceDirName, pathToDir);

  const isLocal = (pathToResource) => {
    const fullUrl = new URL(pathToResource, baseUrl);
    return (fullUrl.hostname === url.hostname);
  };

  return axios.get(url.href)
    .then((response) => {
      const $ = cheerio.load(response.data);
      const resourcePaths = Object.keys(tags).reduce(
        (acc, tagName) => [...acc, ...getResourcePaths($, tagName)],
        [],
      );
      const uniqueResourcePaths = uniq(resourcePaths);
      const uniqueLocalResourcePaths = uniqueResourcePaths.filter(isLocal);
      console.log(uniqueLocalResourcePaths);

      const resourceInfoObjs = uniqueLocalResourcePaths.map((resourcePath) => {
        const dlLink = new URL(resourcePath, baseUrl).href;
        const resourceFileName = generateResourceFileName(resourcePath);
        const newLink = `${resourceDirName}/${resourceFileName}`;
        return {
          resourcePath,
          dlLink,
          resourceFileName,
          newLink,
        };
      });
      console.log(resourceInfoObjs);

      const loadResource = (resourceInfoObj) => {
        const { dlLink } = resourceInfoObj;
        return axios.get(dlLink).then(({ data }) => ({
          ...resourceInfoObj,
          data,
        }));
      };
      return Promise.all(resourceInfoObjs.map(loadResource));
    })
    .then(console.log);
};

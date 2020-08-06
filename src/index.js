import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';
import cheerio from 'cheerio';

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

const getLinks = ($, tagName, linkAttr) => {
  const links = $(tagName).map((i, el) => ({
    link: $(el).attr(linkAttr),
    element: el,
  })).get();
  return links.filter(({ link }) => (link !== undefined));
};

export default (urlString, pathToDir) => {
  const testMode = process.env.TEST_MODE;
  if (testMode === 'true') {
    axios.defaults.adapter = nodeAdapter;
  }

  const url = new URL(urlString);
  const baseUrl = url.origin;
  const pageFilePath = path.join(generateLocalFileName(url), pathToDir);
  const resourceDirPath = path.join(generateResourceDirName(url), pathToDir);

  const isLocal = (pathToResource) => {
    const fullUrl = new URL(pathToResource, baseUrl);
    return (fullUrl.hostname === url.hostname);
  };

  return axios.get(url.href)
    .then((response) => {
      const $ = cheerio.load(response.data);
      const links = Object.values(tags).reduce(
        (acc, { tagName, linkAttr }) => [...acc, ...getLinks($, tagName, linkAttr)],
        [],
      );
      const localLinks = links.filter(({ link }) => isLocal(link));
      console.log(localLinks.map(({ link }) => link));

      const resources = {};
      localLinks.forEach(({ link, element }) => {
        const localFileName = generateResourceFileName(link);
        const fullUrl = new URL(link, baseUrl).href;
        if (!resources[fullUrl]) {
          resources[fullUrl] = {
            localFileName,
            fullUrl,
            linkedElements: [element],
          };
        } else {
          resources[fullUrl].linkedElements.push(element);
        }
      });
      console.log(resources);
      
    });
};

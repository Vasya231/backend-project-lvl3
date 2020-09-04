import * as yup from 'yup';

import path from 'path';
import cheerio from 'cheerio';
import beautify from 'js-beautify';
import { promises as fs } from 'fs';
import Listr from 'listr';
import { uniq } from 'lodash';

import logger from './lib/logger';
import { generateLocalPaths, getResourceFilenameGenerationFunction } from './nameGenerators';
import friendifyError from './friendifyError';
import { sendGetReqWithTimeout, isLocal } from './utils';

const tagLinkMap = {
  img: 'src',
  script: 'src',
  link: 'href',
};

const tags = Object.keys(tagLinkMap);

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

const extractAndReplaceLinks = (html, pageUrl, resourceDirName) => {
  const $ = cheerio.load(html);
  logger.dom('Html parsed.');
  const { origin } = pageUrl;
  const generateResourceFileName = getResourceFilenameGenerationFunction();

  const extractLocalLinks = (tagName) => {
    logger.dom(`Processing tag: "${tagName}"`);
    const attributeWithLink = tagLinkMap[tagName];
    const links = $(tagName).map((index, element) => $(element).attr(attributeWithLink)).get();
    return links.filter((link) => (link && isLocal(link, pageUrl)));
  };

  const localLinks = tags.reduce(
    (acc, tag) => [...acc, ...extractLocalLinks(tag)],
    [],
  );
  logger.dom(`Local links: ${localLinks}`);
  const uniqueLocalLinks = uniq(localLinks);
  logger.dom(`Unique local links: ${uniqueLocalLinks}`);
  const resourcesWithLinks = uniqueLocalLinks.map((link) => {
    const dlLinkURL = new URL(link, origin);
    return {
      localLink: link,
      dlLink: dlLinkURL.href,
      filename: generateResourceFileName(dlLinkURL),
    };
  });
  logger.dom('%o', resourcesWithLinks);

  resourcesWithLinks.forEach(({ localLink, filename }) => {
    const newLink = path.join(resourceDirName, filename);
    tags.forEach((tagName) => {
      const attributeWithLink = tagLinkMap[tagName];
      $(`${tagName}[${attributeWithLink}='${localLink}']`)
        .each((index, element) => $(element).attr(attributeWithLink, newLink));
    });
  });

  const renderedHtml = beautify.html(
    $.root().html(),
    { indent_size: 2 },
  );

  return { resourcesWithLinks, renderedHtml };
};

const downloadResource = (dlLink, filePath, timeout) => sendGetReqWithTimeout(
  dlLink, timeout, { responseType: 'arraybuffer' },
).then(({ data }) => {
  logger.network(`${dlLink} successfully loaded.`);
  return fs.writeFile(filePath, data)
    .then(() => logger.fs(`Resource file saved, path: ${filePath}`));
});

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

  let resourcesWithLinks;
  let renderedHtml;

  return sendGetReqWithTimeout(pageUrl.href, timeout)
    .then((response) => {
      logger.network('Page loaded.');

      ({
        resourcesWithLinks, renderedHtml,
      } = extractAndReplaceLinks(response.data, pageUrl, resourceDirName));
      logger.main('Local resources:');
      resourcesWithLinks.forEach(({ dlLink, filename }) => {
        logger.main(`${dlLink} : ${filename}`);
      });
    })
    .then(() => fs.mkdir(resourceDirPath))
    .then(() => {
      logger.fs(`Created directory ${resourceDirPath}`);
      return fs.writeFile(pageFilePath, renderedHtml, 'utf-8');
    })
    .then(() => {
      logger.fs(`Saved page ${pageFilePath}`);
      const tasks = resourcesWithLinks
        .map(({ dlLink, filename }) => {
          const resourceFilePath = path.join(resourceDirPath, filename);
          return {
            title: `Downloading ${dlLink} to ${resourceFilePath}`,
            task: () => downloadResource(dlLink, resourceFilePath, timeout)
              .catch(transformError),
          };
        });
      return (new Listr(tasks, { concurrent: true, exitOnError: false })).run();
    })
    .catch(transformError);
};

import path from 'path';
import { words, compact } from 'lodash';

const transformString = (str) => words([str], /\w+/g).join('-');

const generatePrefix = (url) => {
  const { search, hostname, pathname } = url;
  const extension = path.posix.extname(pathname);
  const dirname = path.posix.dirname(pathname);
  const basename = path.posix.basename(pathname, extension);
  const prefixParts = [hostname, dirname, basename, search].map(transformString);
  return compact(prefixParts).join('-');
};

export const getResourceFilenameGenerationFunction = () => {
  const usedNamesWithUseCount = new Map();
  return (url) => {
    const { pathname, search } = url;
    const extension = path.posix.extname(pathname);
    const prefix = generatePrefix({ pathname, search, hostname: '' });
    const baseFilename = `${prefix}${extension}`;
    const timesUsed = usedNamesWithUseCount.get(baseFilename);
    if (!timesUsed) {
      usedNamesWithUseCount.set(baseFilename, 1);
      return baseFilename;
    }
    usedNamesWithUseCount.set(baseFilename, timesUsed + 1);
    return `${prefix}(${timesUsed})${extension}`;
  };
};

export const generateLocalPaths = (pageUrl, pathToDir) => {
  const fullPathToDir = path.resolve(process.cwd(), pathToDir);
  const prefix = generatePrefix(pageUrl);
  const pageFileName = `${prefix}.html`;
  const pageFilePath = path.join(fullPathToDir, pageFileName);
  const resourceDirName = `${prefix}_files`;
  const resourceDirPath = path.join(fullPathToDir, resourceDirName);
  return {
    pageFilePath,
    resourceDirName,
    resourceDirPath,
  };
};

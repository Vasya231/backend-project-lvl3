import path from 'path';

const transformString = (str) => str.replace(/\W/, '-');

const parsePathname = (pathname) => {
  const pathnameParts = pathname.split('/').filter((part) => part !== '');
  if (pathname.endsWith('/')) {
    return {
      pathnameParts,
      filename: '',
      extension: null,
    };
  }
  const pathnamePartsCount = pathnameParts.length;
  const fullFilename = pathnameParts[pathnamePartsCount - 1];
  const extension = path.extname(fullFilename);
  const filename = path.basename(fullFilename, extension);
  return {
    pathnameParts: pathnameParts.slice(0, pathnamePartsCount - 1),
    filename,
    extension,
  };
};

const generatePrefix = (url, isResource = false) => {
  const { search, hostname, pathname } = url;
  const { pathnameParts, filename } = parsePathname(pathname);
  const formattedSearch = (search !== '')
    ? search.slice(0, search.length - 1)
    : '';
  const prefixFromHostname = isResource ? '' : hostname;
  const prefixParts = [prefixFromHostname, ...pathnameParts, filename, formattedSearch];
  const transformedPrefix = prefixParts
    .filter((part) => part !== '')
    .map(transformString)
    .join('-');
  return transformedPrefix;
};

export const generateLocalFileName = (url) => {
  const { pathname } = url;
  const { extension } = parsePathname(pathname);
  const transformedSuffix = extension ? `.${transformString(extension.slice(1))}` : '.html';
  const transformedPrefix = generatePrefix(url);
  return `${transformedPrefix}${transformedSuffix}`;
};

export const generateResourceDirName = (url) => `${generatePrefix(url)}_files`;

export const getResourceFilenameGenerationFunction = () => {
  const usedNames = new Map();
  return (url) => {
    const { pathname } = url;
    const { extension } = parsePathname(pathname);
    const transformedPrefix = generatePrefix(url, true);
    const transformedSuffix = extension ? `.${transformString(extension.slice(1))}` : '';
    const baseFilename = `${transformedPrefix}${transformedSuffix}`;
    const timesUsed = usedNames.get(baseFilename);
    if (!timesUsed) {
      usedNames.set(baseFilename, 1);
      return baseFilename;
    }
    usedNames.set(baseFilename, timesUsed + 1);
    return `${transformedPrefix}(${timesUsed})${transformedSuffix}`;
  };
};

export const generateLocalPaths = (pageUrl, pathToDir) => {
  const fullPathToDir = path.resolve(process.cwd(), pathToDir);
  const pageFileName = generateLocalFileName(pageUrl);
  const pageFilePath = path.join(fullPathToDir, pageFileName);
  const resourceDirName = generateResourceDirName(pageUrl);
  const resourceDirPath = path.join(fullPathToDir, resourceDirName);
  return {
    pageFilePath,
    resourceDirName,
    resourceDirPath,
  };
};

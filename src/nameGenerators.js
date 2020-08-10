const transformString = (str) => {
  const chars = str.split('');
  const transforemedChars = chars.map(
    (char) => (char.match(/\w/) ? char : '-'),
  );
  return transforemedChars.join('');
};

export const parsePathname = (pathname) => {
  const pathnameParts = pathname.split('/').filter((part) => part !== '');
  if (pathname.endsWith('/')) {
    return {
      pathnameParts,
      filename: '',
      extension: null,
    };
  }
  const pathnamePartsCount = pathnameParts.length;
  const possibleFilename = pathnameParts[pathnamePartsCount - 1];
  const filenameParts = possibleFilename.split('.').filter((part) => part !== '');
  const filenamePartsCount = filenameParts.length;
  const filenameHasExtension = (filenameParts.length > 1) && (!possibleFilename.endsWith('.'));
  if (!filenameHasExtension) {
    return {
      pathnameParts: pathnameParts.slice(0, pathnamePartsCount - 1),
      filename: possibleFilename,
      extension: null,
    };
  }
  const extension = filenameParts[filenamePartsCount - 1];
  const filenameWithoutExtension = filenameParts.slice(0, filenamePartsCount - 1).join('.');
  return {
    pathnameParts: pathnameParts.slice(0, pathnamePartsCount - 1),
    filename: filenameWithoutExtension,
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
  const transformedSuffix = extension ? `.${transformString(extension)}` : '.html';
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
    const transformedSuffix = extension ? `.${transformString(extension)}` : '';
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

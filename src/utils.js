const generatePrefix = (url) => {
  const { hostname, pathname } = url;
  const normalizedPathname = (pathname.endsWith('/'))
    ? pathname.slice(0, pathname.length - 1)
    : pathname;
  const urlWithoutScheme = `${hostname}${normalizedPathname}`;
  const urlChars = urlWithoutScheme.split('');
  const transformedUrlChars = urlChars.map(
    (char) => (char.match(/\w/) ? char : '-'),
  );
  const transformedUrl = transformedUrlChars.join('');
  return transformedUrl;
};

export const generateLocalFileName = (url) => `${generatePrefix(url)}.html`;

export const generateResourceDirName = (url) => `${generatePrefix(url)}_files`;

export const generateResourceFileName = (path) => {
  const pathChars = path.split('');
  const transforemedPathChars = pathChars.map(
    (char) => (char.match(/\w/) ? char : '-'),
  );
  return transforemedPathChars.join('');
};

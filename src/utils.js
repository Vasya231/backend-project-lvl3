export const generateLocalFileName = (url) => {
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
  return `${transformedUrl}.html`;
};

export const somethingElse = () => {};

import errorTables from 'errno';

const syscallTranslations = {
  mkdir: 'create directory',
  getaddrinfo: 'resolve hostname',
  open: 'open file',
};

const otherCodeTranslations = {
  ENOTFOUND: 'DNS lookup failed',
};

const translateCode = (codeToTranslate) => {
  const standartNodeError = errorTables.code[codeToTranslate];
  if (!standartNodeError) {
    return otherCodeTranslations[codeToTranslate] || codeToTranslate;
  }
  return standartNodeError.description;
};

const friendifyFSError = (error) => {
  const {
    code, path: where, syscall,
  } = error;
  const what = syscallTranslations[syscall] || syscall;
  const why = translateCode(code);
  // eslint-disable-next-line no-param-reassign
  error.message = `Cannot ${what} '${where}'. Reason: ${why}`;
  return error;
};

const friendifyAxiosError = (error) => {
  const {
    config: { url: where }, syscall, message, code,
  } = error;
  const what = syscallTranslations[syscall] || syscall || 'load';
  const why = translateCode(code) || message;
  // eslint-disable-next-line no-param-reassign
  error.message = `Cannot ${what} '${where}'. Reason: ${why}`;
  return error;
};

const friendifyError = (error) => {
  const { isAxiosError, code } = error;
  if (isAxiosError) {
    return friendifyAxiosError(error);
  }
  if (code) {
    return friendifyFSError(error);
  }
  return error;
};

export default friendifyError;

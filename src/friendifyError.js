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
    code, path: target, syscall,
  } = error;
  const action = syscallTranslations[syscall] || syscall;
  const reason = translateCode(code);
  return new Error(`Cannot ${action} '${target}'. Reason: ${reason}`);
};

const friendifyAxiosError = (error) => {
  const {
    config: { url: target }, syscall, message, code,
  } = error;
  const action = syscallTranslations[syscall] || syscall || 'load';
  const reason = translateCode(code) || message;
  return new Error(`Cannot ${action} '${target}'. Reason: ${reason}`);
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

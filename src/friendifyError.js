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

const messageGenerators = {
  node: (error) => {
    const {
      code, path: target, syscall,
    } = error;
    const action = syscallTranslations[syscall] || syscall;
    const reason = translateCode(code);
    return `Cannot ${action} '${target}'. Reason: ${reason}`;
  },
  axios: (error) => {
    const {
      config: { url: target }, syscall, message, code,
    } = error;
    const action = syscallTranslations[syscall] || syscall || 'load';
    const reason = translateCode(code) || message;
    return `Cannot ${action} '${target}'. Reason: ${reason}`;
  },
  plain: (error) => error.message,
};

const getErrorType = (error) => {
  const { isAxiosError, code } = error;
  if (isAxiosError) {
    return 'axios';
  }
  if (code) {
    return 'node';
  }
  return 'plain';
};

const friendifyError = (error) => {
  const errorType = getErrorType(error);
  const message = messageGenerators[errorType](error);
  return new Error(message);
};

export default friendifyError;

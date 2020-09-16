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

const messageGenerators = [
  {
    generateMessage: (error) => {
      const {
        config: { url: target }, syscall, message, code,
      } = error;
      const action = syscallTranslations[syscall] || syscall || 'load';
      const reason = translateCode(code) || message;
      return `Cannot ${action} '${target}'. Reason: ${reason}`;
    },
    check: (error) => !!error.isAxiosError,
  },
  {
    generateMessage: (error) => {
      const {
        code, path: target, syscall,
      } = error;
      const action = syscallTranslations[syscall] || syscall;
      const reason = translateCode(code);
      return `Cannot ${action} '${target}'. Reason: ${reason}`;
    },
    check: (error) => !!error.code,
  },
  {
    generateMessage: (error) => error.message,
    check: () => true,
  },
];

const friendifyError = (error) => {
  const { generateMessage } = messageGenerators.find(({ check }) => check(error));
  const message = generateMessage(error);
  return new Error(message);
};

export default friendifyError;

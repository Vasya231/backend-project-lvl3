import * as yup from 'yup';

import { listrExecute, noRenderExecute } from './promiseRunners';
// import generatePromises from './generatePromises';
import logger from './lib/logger';
import PromiseGenerator from './PromiseGenerator';

const defaultConfig = {
  timeout: 3000,
};

const argumentsValidationSchema = yup.object().shape({
  pageAddress: yup.string().required().url((obj) => `Invalid URL: ${obj.value}`),
  pathToDir: yup.string(),
  userConfig: yup.object(),
});

const validateArguments = (pageAddress, pathToDir, userConfig) => {
  logger.main('Validating arguments.');
  argumentsValidationSchema.validateSync({
    pageAddress, pathToDir, userConfig,
  }, { strict: true });
};

const runDownloadPageWith = (pageAddress, pathToDir, promiseRunner, userConfig = defaultConfig) => {
  try {
    validateArguments(pageAddress, pathToDir, userConfig);
  } catch (e) {
    return Promise.reject(e);
  }

  const config = { ...defaultConfig, ...userConfig };
  // const allPromises = generatePromises(pageAddress, pathToDir, config);
  const promiseGenerator = new PromiseGenerator(pageAddress, pathToDir, config);

  return promiseRunner(promiseGenerator);
};

export const downloadPage = (pageAddress, pathToDir, userConfig) => runDownloadPageWith(
  pageAddress, pathToDir, noRenderExecute, userConfig,
);

export const downloadPageCli = (pageAddress, pathToDir, userConfig) => runDownloadPageWith(
  pageAddress, pathToDir, listrExecute, userConfig,
);

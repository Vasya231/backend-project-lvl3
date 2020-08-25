import * as yup from 'yup';

import { listrExecute, noRenderExecute } from './promiseRunners';
import logger from './lib/logger';
import PromiseGenerator from './PromiseGenerator';

const argumentsValidationSchema = yup.object().shape({
  pageAddress: yup.string().required().url((obj) => `Invalid URL: ${obj.value}`),
  pathToDir: yup.string(),
  timeout: yup.number().integer('Timeout must be integer').min(0, 'Timeout must be positive'),
});

const validateArguments = (pageAddress, pathToDir, timeout) => {
  logger.main('Validating arguments.');
  argumentsValidationSchema.validateSync({
    pageAddress, pathToDir, timeout,
  }, { strict: true });
};

const runDownloadPageWith = (pageAddress, pathToDir, promiseRunner, timeout) => {
  try {
    validateArguments(pageAddress, pathToDir, Number(timeout));
  } catch (e) {
    return Promise.reject(e);
  }
  const promiseGenerator = new PromiseGenerator(pageAddress, pathToDir, timeout);

  return promiseRunner(promiseGenerator);
};

export const downloadPage = (pageAddress, pathToDir, timeout = 3000) => runDownloadPageWith(
  pageAddress, pathToDir, noRenderExecute, timeout,
);

export const downloadPageCli = (pageAddress, pathToDir, timeout = 3000) => runDownloadPageWith(
  pageAddress, pathToDir, listrExecute, timeout,
);

import { isString } from 'lodash';

import 'axios-debug-log';

import { listrExecute, noRenderExecute } from './promiseRunners';
import generatePromises from './generatePromises';
import logger from './lib/logger';

const defaultConfig = {
  testMode: false,
  timeout: 3000,
  promiseRunner: 'default',
};

const validateArguments = (pageAddress, pathToDir, userConfig) => {
  logger.main('Validating arguments.');
  if (!isString(pathToDir)) {
    throw new Error('Path to directory must be a string.');
  }
  if (typeof userConfig !== 'object') {
    throw new Error('Config must be an object.');
  }
  // eslint-disable-next-line no-new
  new URL(pageAddress);
};

const downloadPage = (pageAddress, pathToDir, userConfig = defaultConfig) => {
  validateArguments(pageAddress, pathToDir, userConfig);

  const config = { ...defaultConfig, ...userConfig };
  const allPromises = generatePromises(pageAddress, pathToDir, config, logger);

  return noRenderExecute(allPromises);
};

const downloadPageCli = (pageAddress, pathToDir, userConfig = defaultConfig) => {
  validateArguments(pageAddress, pathToDir, userConfig);

  const config = { ...defaultConfig, ...userConfig };
  const allPromises = generatePromises(pageAddress, pathToDir, config, logger);

  return listrExecute(allPromises);
};

export { downloadPage, downloadPageCli };

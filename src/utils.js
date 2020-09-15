import axios from 'axios';

import 'axios-debug-log';

import logger from './lib/logger';

export const sendGetReqWithTimeout = (url, timeout, options = {}) => {
  const abort = axios.CancelToken.source();
  const errorMessage = `Cannot load '${url}'. Reason: Timeout of ${timeout}ms exceeded.`;
  const timeoutId = setTimeout(
    () => {
      abort.cancel(errorMessage);
      logger.network(`Request ${url} was cancelled due to timeout.`);
    },
    timeout,
  );
  return axios
    .get(url, { cancelToken: abort.token, ...options })
    .catch((thrownObject) => {
      if (!axios.isCancel(thrownObject)) {
        return Promise.reject(thrownObject);
      }
      const { message } = thrownObject;
      const error = new Error(message);
      return Promise.reject(error);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });
};

export const isLocalLink = (pathToResource, pageUrl) => {
  const { origin, hostname } = pageUrl;
  const resourceUrl = new URL(pathToResource, origin);
  return (resourceUrl.hostname === hostname);
};

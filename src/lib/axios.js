import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';

const createAdapter = () => {
  const testMode = process.env.TEST_MODE;
  const config = testMode === 'true'
    ? { adapter: nodeAdapter }
    : {};
  return axios.create(config);
};

export default createAdapter();

export const { CancelToken } = axios;

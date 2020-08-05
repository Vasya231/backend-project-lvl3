import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';

import { generateLocalFileName } from './utils';

export default (urlString, pathToDir) => {
  const testMode = process.env.TEST_MODE;
  if (testMode === 'true') {
    axios.defaults.adapter = nodeAdapter;
  }

  const url = new URL(urlString);
  const localFileName = generateLocalFileName(url);

  return axios.get(url.href).then((response) => {
    if (response.status !== 200) {
      throw new Error('Failed to load the page.');
    }
    fs.writeFile(path.join(pathToDir, localFileName), response.data);
  });
};

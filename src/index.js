import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import nodeAdapter from 'axios/lib/adapters/http';

export default (url, pathToDir) => {
  axios.defaults.adapter = nodeAdapter;
  return axios.get(url).then((response) => {
    console.log(response.data);
    fs.writeFile(path.join(pathToDir, 'index.html'), response.data);
  }).catch((error) => console.log(error));
};

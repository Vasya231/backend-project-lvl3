import { promises as fs } from 'fs';
import path from 'path';

export default (url, pathToDir) => {
  console.log(pathToDir);
  fs.writeFile(path.join(pathToDir, 'index.html'), '!!!');
};

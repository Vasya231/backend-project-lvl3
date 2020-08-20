import debug from 'debug';

const logger = {
  main: debug('page-loader'),
  dom: debug('page-loader.dom'),
  fs: debug('page-loader.file-system'),
  network: debug('page-loader.network'),
};

export default logger;

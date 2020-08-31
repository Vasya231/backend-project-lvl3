#!/usr/bin/env node

import program from 'commander';

import downloadPage from '../index';

program.version('0.0.1')
  .description('Loads and saves web page from internet')
  .option('--output [path]', 'set output directory', process.cwd())
  .option('--timeout [timeout]', 'set request timeout', 3000)
  .arguments('<url>')
  .action((url, cmdObj) => downloadPage(url, cmdObj.output, cmdObj.timeout).catch((e) => {
    console.error(e.message);
    process.exit(1);
  }));

program.parse(process.argv);

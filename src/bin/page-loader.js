#!/usr/bin/env node

import program from 'commander';

import loadAndSavePage from '../index';

program.version('0.0.1')
  .description('Loads and save web page from internet')
  .option('--output [path]', 'set output directory', process.cwd())
  .arguments('<url>')
  .action((url, cmdObj) => {
    loadAndSavePage(url, cmdObj.output).catch((e) => {
      console.error(e.message);
      process.exit(1);
    });
  });
program.parse(process.argv);

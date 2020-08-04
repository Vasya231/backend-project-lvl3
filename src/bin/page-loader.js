#!/usr/bin/env node

import program from 'commander';

program.version('0.0.1')
  .description('Loads and save web page from internet')
  .option('--output [path]', 'set output directory', process.cwd())
  .arguments('<url>')
  .action((url, cmdObj) => {
    console.log(url, cmdObj.output);
  });
program.parse(process.argv);

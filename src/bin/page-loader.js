#!/usr/bin/env node

import program from 'commander';

import { downloadPageCli } from '../index';

program.version('0.0.1')
  .description('Loads and saves web page from internet')
  .option('--output [path]', 'set output directory', process.cwd())
  .arguments('<url>')
  .action((url, cmdObj) => downloadPageCli(url, cmdObj.output).catch((e) => {
    console.error(e.message);
    process.exit(1);
  }));

program.parse(process.argv);

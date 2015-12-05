#!/usr/bin/env node

'use strict';

import url from 'url';
import minimist from 'minimist';
import request from 'request';
import chalk from 'chalk';
import Github from 'github-api';
import gitConfig from 'git-config';
import {spawnSync} from 'child_process';
import getOwerRepo from './getOwerRepo';

const [command] = process.argv.slice(2);
const option = minimist(process.argv.slice(3));
const gitconfig = gitConfig.sync();
const {host, ower, repo} = getOwerRepo();
const accessToken = host === 'github.com' ? gitconfig.gic.token : gitconfig.gic[host].token;

new Github({
  token: accessToken,
  auth: 'oauth',
  apiUrl: host === 'github.com' ? undefined : `https://${host}/api/v3`
})
  .getIssues(ower, repo)
  .list({}, (err, list) => {
    if (err) {
      console.error(err);
    }
    else {
      console.log(chalk.yellow(`${ower}/${repo} have ${list.length} issues`));

      list.forEach(issue => {
        let {number, title, user, assignee, comments} = issue;
        console.log(
          ' ',
          chalk.green(`#${number}`),
          chalk.bold(title)
        );
      });
    }
  });

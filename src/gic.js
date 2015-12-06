#!/usr/bin/env node

'use strict';

import url from 'url';
import minimist from 'minimist';
import request from 'request';
import chalk from 'chalk';
import Github from 'github-api';
import gitConfig from 'git-config';
import {spawnSync} from 'child_process';

const [command] = process.argv.slice(2);
const option = minimist(process.argv.slice(3));
const {host, ower, repo} = getOwerRepo();
const accessToken = getAccessToken(host);

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
      console.log(chalk.yellow(`${ower}/${repo} has ${list.length} issues`));

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

function getOwerRepo () {
  let remoteInformation = spawnSync('git', ['remote', 'show', 'origin']);
  let stdout = remoteInformation.stdout.toString().split('\n');

  let {host, ower, repo} = stdout.map(line => line.trim())
    .filter(line => /^Fetch URL/.test(line))
    .map(line => {
      let origin = line.replace(/^Fetch URL: /, '');
      let {hostname, pathname} = url.parse(origin);
      let [, ower, repo] = pathname.replace(/\.git$/, '').split('/');
      return {host: hostname, ower, repo};
    })
    .pop() || {};

  if (!host || !ower || !repo) {
    console.error(chalk.red('Miss getting Github information(host, ower, repo).'));
    console.error(chalk.red('Is not git repository here?.'));
    process.exit(0);
  }

  return {host, ower, repo};
}

function getAccessToken (host) {
  const config = gicConfig.sync()[`gic "${host}"`];

  if (!config || !config.token) {
    console.error(chalk.red('gic want your access token.'));
    console.error(chalk.red('$ git config --global gic.github.com.token ${YOUR ACCESSTOKEN}'));
    console.error(chalk.red('if you use Github Enterprise, set below.'));
    console.error(chalk.red('$ git config --global gic.GITHUB.ENTERPRISE.HOST.token ${YOUR ACCESSTOKEN}'));
    process.exit(0);
  }

  return config.token;
}

#!/usr/bin/env node

'use strict';

import url from 'url';
import minimist from 'minimist';
import request from 'request';
import chalk from 'chalk';
import Github from 'github';
import editor from 'editor';
import fs from 'fs';
import logUpdate from 'log-update';
import randomstring from 'randomstring';
import {spawnSync} from 'child_process';

let timer;
const progress = ['.', '..', '...', '....', '.....'];
const [command = 'list'] = process.argv.slice(2);
const option = minimist(process.argv.slice(3));
const {host, user, repo} = getUserRepo();
const token = getAccessToken(host);
const githubOption = getGithubOption(host);
const github = new Github(githubOption);
github.authenticate({token, type: 'token'});

if (command === 'list') {
  setStatusMessage('requesting issues');
  github.issues.repoIssues({user, repo}, (err, issues) => {
    if (err) {
      setErrorMessage(err);
      return;
    }
    clearStatus();
    showIssues(issues);
  });
}
else if (command === 'create') {
  getIssueMeesage((title, body) => {
    github.issues.create({user, repo, title, body}, (err, res) => {
      clearStatus();
      if (err) {
        setErrorMessage(err);
        return;
      }
      clearStatus();
      console.log(res.url);
    });
  });
}
else if (command === 'show') {
  let [number] = option._;

  if (number) {
    setStatusMessage(`requesting #${number} issue and comment`);
    github.issues.getRepoIssue({user, repo, number}, (err, issue) => {
      if (err) {
        setErrorMessage(err);
        return;
      }

      github.issues.getComments({user, repo, number}, (err, comments) => {
        if (err) {
          setErrorMessage(err);
          return;
        }
        clearStatus();
        showIssue(issue);
        showComments(number, comments);
      });
    });
  }
}

function setStatusMessage (msg, isProgress = true) {
  if (timer !== undefined) {
    clearInterval(timer);
    timer = undefined;
  }

  if (isProgress) {
    let i = 0;
    timer = setInterval(() => {
      let frame = i++ % progress.length;
      logUpdate(`[${chalk.green('gic')}]`, msg, progress[frame]);
    }, 200);
  }
  else {
    logUpdate(`[${chalk.green('gic')}]`, msg);
  }
}

function setErrorMessage (msg) {
  setStatusMessage('error', false);
  logUpdate.stderr(`[${chalk.red('gic')}]`, msg);
  logUpdate.stderr.done();
}

function clearStatus () {
  setStatusMessage('done', false);
  logUpdate.clear();
  logUpdate.done();
}

function getUserRepo () {
  setStatusMessage('getting user/repo.');
  let remoteInformation = spawnSync('git', ['remote', 'show', 'origin']);
  let stdout = remoteInformation.stdout.toString().split('\n');

  let {host, user, repo} = stdout.map(line => line.trim())
    .filter(line => /^Fetch URL/.test(line))
    .map(line => {
      let origin = line.replace(/^Fetch URL: /, '');
      let {hostname, pathname} = url.parse(origin);
      let [, user, repo] = pathname.replace(/\.git$/, '').split('/');
      return {host: hostname, user, repo};
    })
    .pop() || {};

  if (!host || !user || !repo) {
    console.error(chalk.red('Miss getting Github information(host, user, repo).'));
    console.error(chalk.red('Is not git repository here?.'));
    process.exit(0);
  }

  return {host, user, repo};
}

function getAccessToken (host = 'github.com') {
  setStatusMessage('...getting access token.');
  const token = spawnSync('git', ['config', '--get', `gic.${host}.token`]).stdout.toString();

  if (!token || !token.length) {
    console.error(chalk.red('gic want your access token.'));
    console.error(chalk.red('$ git config --global gic.github.com.token ${YOUR ACCESSTOKEN}'));
    console.error(chalk.red('if you use Github Enterprise, set below.'));
    console.error(chalk.red('$ git config --global gic.GITHUB.ENTERPRISE.HOST.token ${YOUR ACCESSTOKEN}'));
    process.exit(0);
  }

  return token;
}

function getGithubOption (host) {
  const githubOption = {
    version: '3.0.0',
    protocol: 'https',
    timeout: 5000
  };

  if (host !== 'github.com') {
    return {host, pathPrefix: '/api/v3', ...githubOption};
  }
  return githubOption;
}

function getIssueMeesage (callback) {
  let filename = `.${randomstring.generate()}.gic`;
  editor(filename, (code, sig) => {
    let message = fs.readFileSync(filename, 'utf-8');
    let [title = '', ...body] = message.split('\n');
    fs.unlinkSync(filename);
    callback(title, body.join('\n').trim());
  });
}

function showIssues (issues) {
  console.log(chalk.yellow(`${user}/${repo} has ${issues.length} issues`));

  issues.sort(compareIssue).forEach(issue => {
    let {number, title, user, assignee, comments, pull_request} = issue;
    let numberLabel = `#${number}`;
    if (pull_request) {
      numberLabel = `[${numberLabel}]`;
    }
    console.log(
      chalk.green(`  ${numberLabel}`),
      chalk.bold(title)
    );
  });
}

function compareIssue (aIssue, bIssue) {
  return aIssue.number > bIssue.number;
}

function showIssue (issue) {
  let {url, title, body} = issue;

  console.log(chalk.yellow.bold(`\n# ${title}`));
  console.log(`${body}\n`);
}

function showComments (number, comments) {
  comments.forEach(comment => {
    let {body, user} = comment;

    console.log(' ', chalk.blue(`> @${user.login}`));
    console.log(' ', `${body}`);
  });
}

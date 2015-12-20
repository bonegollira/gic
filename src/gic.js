#!/usr/bin/env node

'use strict';

import url from 'url';
import minimist from 'minimist';
import chalk from 'chalk';
import Github from 'github';
import editor from 'editor';
import fs from 'fs';
import logUpdate from 'log-update';
import randomstring from 'randomstring';
import {spawnSync} from 'child_process';

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
  getIssueMeesage((body, title) => {
    github.issues.create({user, repo, title, body}, (err, res) => {
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
else if (command === 'comment') {
  let [number] = option._;

  if (!number) {
    setErrorMessage('$ gic comment [issue_number]');
    process.exit(0);
  }

  getIssueMeesage(body => {
    github.issues.createComment({user, repo, number, body}, (err, res) => {
      if (err) {
        setErrorMessage(err);
        return;
      }
      clearStatus();
      console.log(res.url);
    });
  }, true);
}
else if (command === 'close') {
  let [number] = option._;
  const closeIssue = () => {
    github.issues.edit({user, repo, number, state: 'closed'}, (err, res) => {
      if (err) {
        setErrorMessage(err);
        return;
      }
      clearStatus();
      console.log(res.url);
    });
  };

  if (!number) {
    setErrorMessage('$ gic close [issue_number]');
    process.exit(0);
  }

  getIssueMeesage(body => {
    body ? github.issues.createComment({user, repo, number, body}, (err, res) => {
      if (err) {
        setErrorMessage(err);
        return;
      }
      clearStatus();
      console.log(res.url);
      closeIssue();
    }) : closeIssue();
  }, true);
}

function setStatusMessage (msg) {
  logUpdate(`[${chalk.green('gic')}]`, msg);
}

function setErrorMessage (msg) {
  setStatusMessage('error');
  logUpdate.stderr(`[${chalk.red('gic')}]`, msg);
  logUpdate.stderr.done();
}

function clearStatus () {
  setStatusMessage('done');
  logUpdate.clear();
  logUpdate.done();
}

function getUserRepo () {
  setStatusMessage('getting user/repo');
  let origin = getOriginUrl();

  let {hostname, pathname} = url.parse(origin);
  let [, user, repo] = pathname.replace(/\.git$/, '').split('/');

  if (!hostname || !user || !repo) {
    console.error(chalk.red('Miss getting Github information(host, user, repo).'));
    console.error(chalk.red('Is not git repository here?.'));
    process.exit(0);
  }

  return {host: hostname, user, repo};
}

function getOriginUrl () {
  let localInformation = spawnSync('git', ['config', '--get', 'remote.origin.url']);
  if (localInformation.stdout.toString()) {
    return localInformation.stdout.toString();
  }

  let remoteInformation = spawnSync('git', ['remote', 'show', 'origin']);
  return remoteInformation.stdout.toString().split('\n')
    .filter(line => /^Fetch URL/.test(line))
    .map(line => line.trim().replace(/^Fetch URL: /, ''))
    .pop();
}

function getAccessToken (host = 'github.com') {
  setStatusMessage('getting access token');
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

function getIssueMeesage (callback, isBody) {
  let filename = `.${randomstring.generate()}.gic`;
  editor(filename, () => {
    if (fs.existsSync(filename)) {
      let message = fs.readFileSync(filename, 'utf-8');
      let [title = '', ...bodyLine] = message.split('\n');
      let body = isBody ? message.trim() : bodyLine.join('\n').trim();
      fs.unlinkSync(filename);
      callback(body, title);
    }
    else {
      callback();
    }
  });
}

function showIssues (issues) {
  console.log(chalk.yellow(`${user}/${repo} has ${issues.length} issues`));

  issues.sort(compareIssue).forEach(issue => {
    let {number, title/*, user, assignee, comments*/, pull_request} = issue;
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
  if (aIssue.number > bIssue.number) {
    return 1;
  }
  if (aIssue.number < bIssue.number) {
    return -1;
  }
  return 0;
}

function showIssue (issue) {
  let {/*url, */title, body} = issue;

  console.log(chalk.yellow.bold(`\n# ${title}`));
  console.log(`${body}\n`);
}

function showComments (number, comments) {
  comments.forEach(comment => {
    let {body, user} = comment;

    console.log(' ', chalk.blue(`> @${user.login}`));
    console.log(' ', `${body.replace(/\n/g, '\n  ')}`);
  });
}

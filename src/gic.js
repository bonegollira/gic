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

const argv = minimist(process.argv.slice(2), {
  boolean: ['noprogress']
});
const [command = 'list'] = argv._;
const {noprogress} = argv;
const {host, user, repo} = getUserRepo();
const token = getAccessToken(host);
const githubOption = getGithubOption(host);
const github = new Github(githubOption);
github.authenticate({token, type: 'token'});

if (command === 'list') {
  status('requesting issues');
  repoIssuesPromise()
    .then(issues => {
      clearStatus();
      showIssues(issues);
    })
    .catch(error);
}
else if (command === 'create') {
  getIssueMessagePromise()
    .then(({title, body}) => createPromise(title, body))
    .then(res => {
      clearStatus();
      console.log(res.url);
    })
    .catch(error);
}
else {
  let [, number] = argv._;

  typeof number !== 'number' && error('$ gic show/comment/close [issue_number]');

  if (command === 'show') {
    status(`requesting #${number} issue and comment`);
    Promise.all([getRepoIssuePromise(number), getCommentsPromise(number)])
      .then(([issue, comments]) => {
        clearStatus();
        showIssue(issue);
        showComments(number, comments);
      })
      .catch(error);
  }
  else if (command === 'comment') {
    getIssueMessagePromise(true)
      .then(({body}) => createCommentPromise(number, body))
      .then(res => {
        clearStatus();
        console.log(res.url);
      })
      .catch(error);
  }
  else if (command === 'close') {
    getIssueMessagePromise(true)
      .then(({body}) => body ? createCommentPromise(number, body) : true)
      .then(() => closePromise(number))
      .then(res => {
        clearStatus();
        console.log(res.url);
      })
      .catch(error);
  }
}

function repoIssuesPromise () {
  return createGithubIssuesPromise('repoIssues');
}

function createPromise (title, body) {
  return createGithubIssuesPromise('create', {title, body});
}

function getRepoIssuePromise (number) {
  return createGithubIssuesPromise('getRepoIssue', {number});
}

function getCommentsPromise (number) {
  return createGithubIssuesPromise('getComments', {number});
}

function createCommentPromise (number, body) {
  return createGithubIssuesPromise('createComment', {number, body});
}

function closePromise (number) {
  return createGithubIssuesPromise('edit', {number, state: 'closed'});
}

function createGithubIssuesPromise (api, option = {}) {
  return new Promise((resolve, reject) => {
    github.issues[api]({user, repo, ...option}, (err, res) => {
      err ? reject(err) : resolve(res);
    });
  });
}

function status (message) {
  !noprogress && logUpdate(`[${chalk.green('gic')}]`, message);
}

function clearStatus () {
  logUpdate.clear();
  logUpdate.done();
}

function error (...messages) {
  clearStatus();
  messages.forEach(message => {
    console.error(chalk.red(message));
  });
  process.exit(0);
}

function getUserRepo () {
  status('getting user/repo');
  let origin = getOriginUrl();
  let {hostname, pathname} = url.parse(origin);
  let [, user, repo] = pathname.replace(/\.git$/, '').split('/');

  (!hostname || !user || !repo) && error(
    'Miss getting Github information(host, user, repo).',
    'Is not git repository here?.'
  );

  return {host: hostname, user, repo};
}

function getOriginUrl () {
  return getLocalOriginUrl() || getRemoteOriginUrl();
}

// $ git config --get remote.origin.url
function getLocalOriginUrl () {
  return spawnSync('git', ['config', '--get', 'remote.origin.url']).stdout.toString();
}

// $ git remote show origin
function getRemoteOriginUrl () {
  let remoteInformation = spawnSync('git', ['remote', 'show', 'origin']);
  return remoteInformation.stdout.toString().split('\n')
    .filter(line => /^Fetch URL/.test(line))
    .map(line => line.trim().replace(/^Fetch URL: /, ''))
    .pop();
}

// $ git config --get gic.github.com.token
// $ git config --get gic.github.enterprise.token
function getAccessToken (host = 'github.com') {
  status('getting access token');
  const token = spawnSync('git', ['config', '--get', `gic.${host}.token`]).stdout.toString();

  (!token || !token.length) && error(
    'gic want your access token.',
    '$ git config --global gic.github.com.token ${YOUR ACCESSTOKEN}',
    'if you use Github Enterprise, set below.',
    '$ git config --global gic.GITHUB.ENTERPRISE.HOST.token ${YOUR ACCESSTOKEN}'
  );

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

function getIssueMessagePromise (isBody) {
  let filename = `.${randomstring.generate()}.gic`;
  fs.writeFileSync(filename, '', 'utf-8');

  return new Promise(resolve => {
    editor(filename, () => {
      let message = fs.readFileSync(filename, 'utf-8');
      let [title = '', ...bodyLine] = message.split('\n');
      let body = isBody ? message.trim() : bodyLine.join('\n').trim();
      fs.unlinkSync(filename);
      resolve({title, body});
    });
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
  let {title, body, labels, milestone, assignee} = issue;

  labels.length && console.log(chalk.underline(`labels: ${labels.map(label => label.name).join(', ')}`));
  milestone && console.log(chalk.underline(`milestone: ${milestone.title}`));
  assignee && console.log(chalk.underline(`assignee: @${assignee.login}`));
  console.log(chalk.yellow.bold(`# ${title}`));
  body ? console.log(`${body}`) : console.log(chalk.gray.dim('No description provided.'));
}

function showComments (number, comments) {
  comments.forEach(comment => {
    let {body, user} = comment;

    console.log('\n ', chalk.blue(`> @${user.login}`));
    console.log(' ', `${body.replace(/\n/g, '\n  ')}`);
  });
}

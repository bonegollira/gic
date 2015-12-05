#!/usr/bin/env node

'use strict';

import url from 'url';
import {spawnSync} from 'child_process';

export default function () {
  let remoteInformation = spawnSync('git', ['remote', 'show', 'origin']);
  let stdout = remoteInformation.stdout.toString().split('\n');

  return stdout.map(line => line.trim())
    .filter(line => /^Fetch URL/.test(line))
    .map(line => {
      let origin = line.replace(/^Fetch URL: /, '');
      let {hostname, pathname} = url.parse(origin);
      let [, ower, repo] = pathname.replace(/\.git$/, '').split('/');
      return {host: hostname, ower, repo};
    })
    .pop();
}

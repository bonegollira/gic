# gic
GitHub Issues Command line tool.

# Install

```sh
$ npm install -g gic
```

# Usage

set access token get from [tokens](https://github.com/settings/tokens)

```
// ~/.gitconfig

[gic "github.com"]
  token = [ACCESS TOKEN]

// if you use Github Enterprise
[gic "enterprise.github.com"]
  token = [ACCESS TOKEN]
```

or

```sh
$ git config --global gic.github.com.token [ACCESS TOKEN]
$ git config --global gic.enterprise.github.com.token [ACCESS TOKEN]
```

```sh
$ gic [command = list]
```

# Command

### list

Show all issues on repository.

### create

Create issue on repository, launch editor for write message.

# ScreenShot

![ScreenShot](images/screenshot.png)

# License

MIT

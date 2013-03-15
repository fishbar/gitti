#!/usr/bin/env node
var Event = require('events').EventEmitter;
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var evt = new Event();
var user = process.argv[2];
var USER_DEFAULT;
process.chdir(process.cwd());

evt.on('error', function (err) {
  console.log(err);
  process.exit();
});

evt.on('total_lines', function (total) {
  console.log('TOTAL:', total);
});

evt.on('author_lines', function (linesadd, linesdel) {
  console.log('author_lines', linesadd, linesdel);
});

function get_git_user() {
  exec('git config user.name', function (err, stdout, stderr) {
    if (err) {
      evt.emit('error', stderr.toString());
    }
    evt.emit('git_user', stdout.trim());
  });
}

/**
 * 计算工程内所有的代码行数
 */
function cal_lines() {
  var CMD_LINES = "find . -type f -regextype posix-extended -not -regex '(.*/\.git/.*|.*/node_modules/.*|.*\.log)' | xargs cat | wc -l";
  exec(CMD_LINES, function (err, stdout, stderr) {
    if (err) {
      evt.emit('error', stderr.toString());
    }
    evt.emit('total_lines', stdout.trim());
  });
}
/**
 * 计算某人的贡献数
 * @param  {[type]}   option [description]
 * @param  {Function} cb     [description]
 * @return {[type]}          [description]
 */
function cal_author_lines(option, cb) {
  var CMD_GIT = 'git';
  var PARAMS = ['log', '--author=' + option.user,  '--shortstat', '--pretty=format:'];
  var gitlog = spawn(CMD_GIT, PARAMS, {cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe']});
  var buf_data = '';
  var buf_err = '';
  var linesAdd = 0;
  var linesDel = 0;
  gitlog.stdout.on('data', function (dd) {
    var res = processData(buf_data + dd.toString());
    buf_data = res.rest;
    linesAdd += res.add;
    linesDel += res.del;
  });
  gitlog.stderr.on('data', function (dd) {
    buf_err += dd.toString();
  });
  gitlog.on('close', function () {
    // DONE
    if (buf_err) {
      cb(buf_err);
    } else {
      var res = processData(buf_data);
      linesAdd += res.add;
      linesDel += res.del;
      cb(null, linesAdd, linesDel);
    }
  });
}

function processData(str, end) {
  var lines = str.split('\n');
  var res = {};
  if (!end) {
    res.rest = lines.pop();
  }
  var add = 0;
  var del = 0;
  var file = 0;
  var exp = /(\d+) .*?, (\d+) .*?, (\d+) .*/;
  lines.forEach(function (v) {
    if (!v.trim()) {
      return;
    }
    var m = v.match(exp);
    if (!m) {
      console.error('git log not match:', v, exp);
      process.exit();
    }
    add += parseInt(m[2], 10);
    del += parseInt(m[3], 10);
    file += parseInt(m[1], 10);
  });
  res.add = add;
  res.del = del;
  res.file = file;
  return res;
}

cal_lines();

evt.on('git_user', function (gituser) {
  USER_DEFAULT = gituser;
  if (!user) {
    user = gituser;
  }
  cal_author_lines({user: user}, function (err, linesAdd, linesDel) {
    console.log(user + ':', '(+)' + linesAdd, '(-)' + linesDel);
  });
});

get_git_user();
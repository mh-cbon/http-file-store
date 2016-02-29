var child = require('child_process').spawn

var http = child('http-server', ['public', '-o', '-c-1']);
var store = child('node', ['../bin.js', '-c', './config.json', '-v']);

http.stdout.pipe(process.stdout);
http.stderr.pipe(process.stderr);
store.stdout.pipe(process.stdout);
store.stderr.pipe(process.stderr);

process.on('SIGINT', function () {
  http.kill()
  store.kill()
})

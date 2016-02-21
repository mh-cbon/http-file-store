var painless  = require('painless');
var test      = painless.createGroup();
var assert    = painless.assert;

var path        = require('path')
var fs          = require('node-fs');
var fixturePath = path.join(process.cwd(), "test", "fixtures");

fs.mkdirSync(fixturePath, 0o777, true);
fs.mkdirSync(path.join(fixturePath, 'sub'), 0o777, true);
fs.writeFileSync(path.join(fixturePath, "some.txt"), "content");
fs.writeFileSync(path.join(fixturePath, "sub", "other.txt"), "empty");

var request   = require('supertest');
var express   = require('express');
var multer    = require('multer');
var fileStore = require('../index.js');
var read      = fileStore.read('test/fixtures/');

var upload  = multer({ dest: path.join(fixturePath, 'uploads') });
var app     = express();

app.use('/read', fileStore.read(fixturePath));
app.use('/write', upload.single('file'), fileStore.write(fixturePath, true));
app.use('/no_overwrite', upload.single('file'), fileStore.write(fixturePath, false));

// Callback test
test('read file on root', function(done) {
  request(app)
    .get('/read/some.txt')
    .expect('Content-Type', /text/)
    .expect(200, /content/)
    .end(done)
});
test('read a file within a sub diretory', function(done) {
  request(app)
    .get('/read/sub/other.txt')
    .expect('Content-Type', /text/)
    .expect(200, /empty/)
    .end(done)
});
test('read a directory', function(done) {
  request(app)
    .get('/read/')
    .expect('Content-Type', /json/)
    .expect(200, /^\[{"name":"some.txt","type":"file","size":7/)
    .end(done)
});
test('forbid weird paths', function(done) {
  request(app)
    .get('/read/../whatever')
    .expect(500)
    .end(done)
});
test('write a file on root directory', function(done) {
  request(app)
    .post('/write/')
    .attach('file', path.join(fixturePath, 'sub', 'other.txt'))
    .expect(200)
    .end(done);
});
test('does not overwrite a file', function(done) {
  request(app)
    .post('/write/')
    .attach('file', path.join(fixturePath, 'sub', 'other.txt'))
    .expect(500)
    .end(done);
});
test('does overwrite a file', function(done) {
  request(app)
    .post('/write/?overwrite=1')
    .attach('file', path.join(fixturePath, 'sub', 'other.txt'))
    .expect(200)
    .end(done);
});
test('can not overwrite a file', function(done) {
  request(app)
    .post('/no_overwrite/?overwrite=1')
    .attach('file', path.join(fixturePath, 'sub', 'other.txt'))
    .expect(500)
    .end(done);
});

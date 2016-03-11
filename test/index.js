process.env['DEBUG'] = '@mh-cbon/http-file-store,express'
var painless  = require('painless');
var test      = painless.createGroup();
var assert    = painless.assert;

var path        = require('path')
var fs          = require('node-fs');

var request   = require('supertest');
var express   = require('express');
var multer    = require('multer');
var fileStore = require('../index.js');
var read      = fileStore.read('test/fixtures/');

(function appWithoutAlias() {

  var fixturePath   = path.join(process.cwd(), "test", "fixtures");

  fs.mkdirSync(fixturePath, 0o777, true);
  fs.mkdirSync(path.join(fixturePath, 'sub'), 0o777, true);
  fs.writeFileSync(path.join(fixturePath, "some.txt"), "content");
  fs.writeFileSync(path.join(fixturePath, "sub", "other.txt"), "empty");

  var config = {
    aliases: {
      "": fixturePath
    },
    allow_overwrite: false
  };
  var configOverwrite = {
    aliases: {
      "": fixturePath
    },
    allow_overwrite: true
  }


  var upload  = multer({ dest: path.join(fixturePath, 'uploads') });
  var app     = express();

  app.get('/read/*', fileStore.read(config));
  app.post('/write/*',
    upload.single('file'),
    fileStore.write(configOverwrite));
  app.post('/no_overwrite/*',
    upload.single('file'),
    fileStore.write(config));


  test('read file on root', function(done) {
    request(app)
      .get('/read/some.txt')
      .expect('Content-Type', /text/)
      .expect(200, /content/)
      .end(done)
  });
  test('read non existent file', function(done) {
    request(app)
      .get('/read/nop.txt')
      .expect('Content-Type', /json/)
      .expect(500)
      .end(done)
  });
  test('HEAD on a file on root', function(done) {
    request(app)
      .head('/read/some.txt')
      .expect('Content-Type', /text/)
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
  test('read a non existent directory', function(done) {
    request(app)
      .get('/read/nop/')
      .expect('Content-Type', /json/)
      .expect(500)
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

})();

(function appWithAlias() {

  var fixturePath   = path.join(process.cwd(), "test", "fixtures2");

  fs.mkdirSync(fixturePath, 0o777, true);
  fs.mkdirSync(path.join(fixturePath, 'sub'), 0o777, true);
  fs.writeFileSync(path.join(fixturePath, "some.txt"), "content");
  fs.writeFileSync(path.join(fixturePath, "sub", "other.txt"), "empty");

  var upload  = multer({ dest: path.join(fixturePath, 'uploads') });
  var app     = express();

  var config = {
    aliases: {
      "alias": fixturePath
    },
    allow_overwrite: false
  };

  var configOverwrite = {
    aliases: {
      "alias": fixturePath
    },
    allow_overwrite: true
  };

  app.get('/read/:alias/*', fileStore.read(config));
  app.post('/write/:alias/*',
    upload.single('file'),
    fileStore.write(configOverwrite));
  app.post('/no_overwrite/:alias/*',
    upload.single('file'),
    fileStore.write(config));


  test('read file on root', function(done) {
    request(app)
      .get('/read/alias/some.txt')
      .expect('Content-Type', /text/)
      .expect(200, /content/)
      .end(done)
  });
  test('read a non existent file', function(done) {
    request(app)
      .get('/read/alias/nop.txt')
      .expect('Content-Type', /json/)
      .expect(500)
      .end(done)
  });
  test('HEAD on a file on root', function(done) {
    request(app)
      .head('/read/alias/some.txt')
      .expect('Content-Type', /text/)
      .end(done)
  });
  test('read a file within a sub diretory', function(done) {
    request(app)
      .get('/read/alias/sub/other.txt')
      .expect('Content-Type', /text/)
      .expect(200, /empty/)
      .end(done)
  });
  test('read a directory', function(done) {
    request(app)
      .get('/read/alias/')
      .expect('Content-Type', /json/)
      .expect(200, /^\[{"name":"some.txt","type":"file","size":7/)
      .end(done)
  });
  test('read a non existent directory', function(done) {
    request(app)
      .get('/read/alias/nop/')
      .expect('Content-Type', /json/)
      .expect(500)
      .end(done)
  });
  test('forbid weird paths', function(done) {
    request(app)
      .get('/read/alias/../whatever')
      .expect(500)
      .end(done)
  });
  test('write a file on root directory', function(done) {
    request(app)
      .post('/write/alias/')
      .attach('file', path.join(fixturePath, 'sub', 'other.txt'))
      .expect(200)
      .end(done);
  });
  test('does not overwrite a file', function(done) {
    request(app)
      .post('/write/alias/')
      .attach('file', path.join(fixturePath, 'sub', 'other.txt'))
      .expect(500)
      .end(done);
  });
  test('does overwrite a file', function(done) {
    request(app)
      .post('/write/alias/?overwrite=1')
      .attach('file', path.join(fixturePath, 'sub', 'other.txt'))
      .expect(200)
      .end(done);
  });
  test('can not overwrite a file', function(done) {
    request(app)
      .post('/no_overwrite/alias/?overwrite=1')
      .attach('file', path.join(fixturePath, 'sub', 'other.txt'))
      .expect(500)
      .end(done);
  });
  test('read a non existent alias', function(done) {
    request(app)
      .get('/read/nop/nop/')
      .expect('Content-Type', /json/)
      .expect(500)
      .end(done)
  });
})();

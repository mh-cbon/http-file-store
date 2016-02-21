
var fs    = require('node-fs');
var path  = require('path');
var async = require('async');
var mime  = require('mime');
var send  = require('send');

function fsRead (base) {
  return function (req, res, next) {
    var filePath = path.join(base, req.path);

    if(filePath.match(/[.]{1,2}\//)) return res.status(500).end();

    fs.lstat(filePath, function (err, stats) {
      if (err) return res.status(500).end();

      if (stats.isDirectory()) {
        readDirectory(filePath, function (err, jsonRes) {
          if (err) res.status(500).json(err);
          res.status(200).json(jsonRes);
        })
      }
      if (stats.isFile()) {
        send(req, req.url, {root: base})
          .on('error', console.error.bind(console))
          .pipe(res);
      }

    })
  }
}

function fsWrite (base, allowOverwrite) {
  return function (req, res, next) {

    var overwrite = allowOverwrite && !!req.query.overwrite;

    if (!req.file) return res.status(500).end();

    var fileInfo  = req.file;
    var filename  = fileInfo.originalname;
    var directory = path.join(base, req.path);

    if(directory.match(/[.]{1,2}\//))
      return removeTempFiles(req.file) && res.status(500).end();

    if(filename.match(/[.]{1,2}\//))
      return removeTempFiles(req.file) && res.status(500).end();

    var filePath = path.join( directory, filename );

    async.series( [
        // check if the file exists and if we can overwrite it if it does
        checkExists.bind( null, filePath, overwrite ),

        // create the necessary directory structure
        createDirectory.bind( null, directory ),

        // move the uploaded file from its temp location to the target location
        moveToDestination.bind( null, fileInfo.path, filePath ),

        // set proper permissions on the uploaded file
        setNormalPermissions.bind( null, filePath )

    ], function( err ) {
      removeTempFile(fileInfo.path);
      if ( err ) return res.status(500).json(err);
      readDirectory(directory, function (err, jsonRes) {
        if (err) res.status(500).json(err);
        res.status(200).json(jsonRes);
      })
    });

  }
}

function checkExists( filename, overwritable, then ) {
  fs.exists( filename, function( exists ) {
    var err;
    if ( exists && !overwritable )
      err = {
        error: 'file exists',
        message: 'The file you are trying to upload already exists and cannot be overwritten.',
        code: 400
      };
    then(err);
  });
}

function createDirectory( directory, then ) {
  fs.mkdir( directory, '0755', true, function( error ) {
    var err;
    if ( error )
      err = {
        error: 'error creating directory',
        message: error,
        code: 500
      };
    then(err);
  });
}

function moveToDestination( source, dest, then ) {
  fs.rename( source, dest, function( error ) {
    var err;
    if ( error )
      err = {
        error: 'error moving file',
        message: error,
        code: 500
      };
    then(err);
  });
}

function setNormalPermissions( filename, then ) {
  fs.chmod( filename, '0644', function( error ) {
    var err;
    if ( error )
      err = {
        error: 'error changing file permissions',
        message: error,
        code: 500
      };
    then(err);
  });
}

function readDirectory( filePath, then ) {
  fs.readdir(filePath, function (err, files) {
    if (err) return then({
      error: 'error reading directory',
      message: err,
      code: 500
    })
    var jsonRes = [];
    files.forEach(function (f) {
      var stats = fs.statSync(path.join(filePath, f))
      jsonRes.push({
        name: f,
        type: stats.isFile() ? 'file' : 'dir',
        size: stats.size,
        mime: mime.lookup(path.join(filePath, f)) || 'application/octet-stream',
        atime: stats.atime,
        mtime: stats.mtime,
        ctime: stats.ctime,
        birthtime: stats.birthtime
      })
    })
    then(null, jsonRes)
  });
}

function removeTempFile(filePath){
  if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = {
  read: fsRead,
  write: fsWrite
}

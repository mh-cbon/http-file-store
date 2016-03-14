
var pkg       = require('./package.json')
var fs        = require('fs-extra');
var path      = require('path');
var async     = require('async');
var mime      = require('mime');
var send      = require('send');
var reqFsPath = require('./lib/req_to_filepath.js');
var debug     = require('debug')(pkg.name);

function fsRead (config) {
  return function (req, res, next) {
    var filePath = reqFsPath(config, req);

    debug('filepath=%s', filePath);

    if(!filePath) return res.status(500).json({
      error: 'File does not exist',
      message: null
    });

    if(filePath.match(/[.]{1,2}\//)) return res.status(500).json({
      error: 'Unexpected parameters value',
      message: null
    });

    fs.lstat(filePath, function (err, stats) {
      err && console.error(err);
      if (err) return res.status(500).json({
        error: 'File does not exist',
        message: err
      });

      if (stats.isDirectory()) {
        var show_absolute_path = config.show_absolute_path;
        readDirectory(filePath, show_absolute_path, function (err, jsonRes) {
          if (err) return res.status(500).json(err);
          res.status(200).json(jsonRes);
        })
      }
      if (stats.isFile()) {
        send(req, filePath, {extensions: false, index: false})
          .on('error', console.error.bind(console))
          .on('headers', function headers(res, p, s) {
            req.query.download==='1' &&
            res.setHeader('Content-Disposition', 'attachment; filename=' + path.basename(filePath));
          })
          .pipe(res);
      }
    })

  }
}

function fsWrite (config) {
  var allowOverwrite  = config.allow_overwrite;
  var showAbsPath     = config.show_absolute_path;
  return function (req, res, next) {

    var overwrite = !!allowOverwrite && !!req.query.overwrite;

    debug('req.file=%j allow_overwrite=%j', req.file, overwrite);
    if (!req.file) return res.status(500).json({
      error: 'Missing "file" parameter',
      message: null
    });

    var fileInfo  = req.file;
    var filename  = fileInfo.originalname;
    var directory = reqFsPath(config, req);

    debug('directory=%s', directory);
    debug('filename=%s', filename);
    if( !directory ||
        directory.match(/[.]{1,2}\//) ||   // must not match ./ or ../
        filename.match(/\\|\//) )          // must not match any slash, dot is allowed.
      return removeTempFile(fileInfo.path, function (err) {
        err && console.error(err);
        res.status(500).json({
          error: 'Unexpected parameters value',
          message: null
        });
      });

    var filePath = path.join(directory, filename);
    debug('filePath=%s', filePath);

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
      err && console.error(err);
      removeTempFile(fileInfo.path, function (cleanUpErr) {
        cleanUpErr && console.error(cleanUpErr);
        if ( err ) return res.status(500).json(err);
        readDirectory(directory, showAbsPath, function (err, jsonRes) {
          if (err) return res.status(500).json(err);
          res.status(200).json(jsonRes);
        })
      });
    });

  }
}

function fsDelete (config) {
  return function (req, res, next) {
    var filePath = reqFsPath(config, req);

    debug('filepath=%s', filePath);

    if(!filePath) return res.status(500).json({
      error: 'File does not exist',
      message: null
    });

    if(filePath.match(/[.]{1,2}\//)) return res.status(500).json({
      error: 'Unexpected parameters value',
      message: null
    });

    fs.lstat(filePath, function (err, stats) {

      err && console.error(err);
      if (err) return res.status(500).json({
        error: 'File does not exist',
        message: err
      });

      var show_absolute_path = config.show_absolute_path;

      if (stats.isDirectory()) {

        var isAnAlias = false
        Object.keys(config.aliases).forEach(function isAnAlias(alias) {
          var p = config.aliases[alias];
          if (path.resolve(process.cwd(), p)===path.resolve(process.cwd(), filePath)) {
            isAnAlias = true;
          }
        })

        if (isAnAlias) return res.status(500).json({
          error: 'Path must not be an aliased directory',
          message: err
        });

        fs.rmdir(filePath, function (err) {
          if (err) {
            console.error(err);

            var recursive = !!req.query.recursive;
            if (!recursive) return res.status(500).json({
              error: 'File can not be removed',
              message: err
            });

            fs.remove(filePath, function (err) {
              err && console.error(err);
              if (err) return res.status(500).json({
                error: 'File can not be removed',
                message: err
              });
              readDirectory(path.resolve(filePath, '..'), show_absolute_path, function (err, jsonRes) {
                if (err) return res.status(500).json(err);
                res.status(200).json(jsonRes);
              })
            })
          } else {
            readDirectory(path.resolve(filePath, '..'), show_absolute_path, function (err, jsonRes) {
              if (err) return res.status(500).json(err);
              res.status(200).json(jsonRes);
            })
          }
        });
      }

      if (stats.isFile()) {
        fs.unlink(filePath, function (err) {
          if (err) {
            console.error(err);
            return res.status(500).json({
              error: 'File can not be removed',
              message: err
            });
          }
          readDirectory(path.resolve(filePath, '..'), show_absolute_path, function (err, jsonRes) {
            if (err) return res.status(500).json(err);
            res.status(200).json(jsonRes);
          })
        });
      }
    })

  }
}

// alias manipulation
function getRoot (config) {
  return function (req, res, next) {
    return res.status(200).json(listAliasesAsDirectories(config))
  }
}
function aliasesGet (config) {
  return function (req, res, next) {
    return res.status(200).json(config.aliases || {})
  }
}
function aliasAdd (config, configPath) {
  return function (req, res, next) {
    var name      = req.body.name;
    var aliasPath = req.body.path;

    if (name in config.aliases) return res.status(500).json({
      error: 'Alias already exist',
      message: err
    });

    fs.lstat(aliasPath, function (err, stats) {
      err && console.error(err);
      if (err) return res.status(500).json({
        error: 'Path does not exist',
        message: err
      });

      if (!stats.isDirectory()) return res.status(500).json({
        error: 'Path must be a directory',
        message: err
      });

      config.aliases[name] = path;

      if (!req.persist) return;

      fs.writeFile(configPath, JSON.stringify(config, null, 4), function (err) {
        if (err) {
          console.error(err);
          delete config.aliases[name];
          return res.status(500).json({
            error: 'Failed to write the configuration file',
            message: err
          });
        }
        return res.status(200).json(config.aliases || {})
      })

    })
  }
}
function aliasRemove (config) {
  return function (req, res, next) {
    var name      = req.body.name;

    if (!(name in config.aliases)) return res.status(500).json({
      error: 'Alias does not exist',
      message: err
    });

    var oldPath = config.aliases[name];
    delete config.aliases[name];

    if (!req.persist) return;

    fs.writeFile(configPath, JSON.stringify(config, null, 4), function (err) {
      if (err) {
        console.error(err);
        config.aliases[name] = oldPath;
        return res.status(500).json({
          error: 'Failed to write the configuration file',
          message: err
        });
      }
      return res.status(200).json(config.aliases || {})
    })

  }
}

// utilities
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
  fs.mkdirs( directory, '0755', function( error ) {
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
  var error;
  fs.createReadStream(source)
  .pipe(fs.createWriteStream(dest))
  .on('error', function (e) {
    error = e;
  }).on('close', function () {
    var err;
    if ( error )
      err = {
        error: 'error moving file',
        message: error,
        code: 500
      };
    then(err);
  })
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

function readDirectory( filePath, showAbsPath, then ) {
  fs.readdir(filePath, function (err, files) {
    if (err) return then({
      error: 'error reading directory',
      message: err,
      code: 500
    })
    var jsonRes = [];
    files.forEach(function (f) {
      var absPath = path.resolve(path.join(filePath, f));
      var stats = fs.statSync(absPath);
      var item = {
        name:   f,
        type:   stats.isFile() ? 'file' : 'dir',
        size:   stats.size,
        mime:   mime.lookup(f) || 'application/octet-stream',
        atime:  stats.atime,
        mtime:  stats.mtime,
        ctime:  stats.ctime,
        birthtime: stats.birthtime
      };
      if (showAbsPath) item.absolute_path = absPath;
      jsonRes.push(item)
    })
    then(null, jsonRes)
  });
}

function removeTempFile(filePath, then){
  if(fs.access) return fs.access(filePath, fs.R_OK, function (err) {
    if(err) return then(err);
    fs.unlink(filePath, then)
  })
  fs.exists && fs.exists(filePath, function (exists) {
    if(exists) return fs.unlink(filePath, then)
    then(err)
  })
}


// alias utilities
function listAliasesAsDirectories (config) {
  var jsonRes = [];
  Object.keys(config.aliases).forEach(function (alias) {
    var item = {
      name:   alias,
      type:   'alias',
      size:   0,
      mime:   'application/octet-stream',
      atime:  0,
      mtime:  0,
      ctime:  0,
      birthtime: 0
    };
    if (config.show_absolute_path) item.absolute_path = path.resolve(process.cwd(), config.aliases[alias]);
    jsonRes.push(item)
  })
  return jsonRes;
}


// exports
module.exports = {
  aliases: {
    get:    aliasesGet,
    add:    aliasAdd,
    remove: aliasRemove
  },
  root:   getRoot,
  read:   fsRead,
  write:  fsWrite,
  unlink: fsDelete
}

var pkg   = require('../package.json')
var debug = require('debug')(pkg.name);
var path  = require('path');

function reqToFilepath (config, req) {
  // if req has an alias parameter
  //    look up for alias within aliases to resolve to the base file system path
  // if req does not have alias parameter, and config has only one alias
  //    look up for an empty alias name to resolve to the base file system path

  debug('req.params %j', req.params)
  debug('config.aliases %j', config.aliases)

  var baseFs    = false;
  var reqFsPath = req.params[0]; // http://expressjs.com/en/api.html#req.params
  if ('alias' in req.params) {
    baseFs = config.aliases[req.params.alias];
  } else if(Object.keys(config.aliases).length===1 && "" in config.aliases) {
    baseFs = config.aliases[""];
  }

  if (!baseFs) return false;

  return path.resolve(
    process.cwd(),
    path.join(baseFs, reqFsPath)
  );
}

module.exports = reqToFilepath;

#!/usr/bin/env node

function usage () {/*

Usage

  http-file-store --config=/path/to/config.json

Options

  --config  | -c   Path to the JSON configuration file
  --port    | -p   Port of the CLEAR http server, if no configuration is provided.
  --verbose | -v   Enable verbosity pass in the module list to debug.

Config

  The configuration is a plain json object describing several options to
  apply to your instance of http-file-store.

  {
    "url_base": "/base/url/to/serve/files/ending/with/slash",
    "upload_path": "/base/to/temp/uploaded/files",
    "show_absolute_path": true|false,
    "allow_overwrite": true|false,
    "configurable_alias": true|false,
    "allow_delete": true|false,
    "aliases": {
      "url_name": "/path/to/the/directory/to/read/write/files"
    },
    "ssl": {
      "port": "a number, or null for a random port",
      "host": "a host value to listen for https requests",
      "key": "a path to an SSL key",
      "ca": "a path to the SSL CA file",
      "cert": "a path to the SSL cert file"
    },
    "clear": {
      "port": "a number, or null for a random port",
      "host": "a host value to listen for http requests"
    },
    "cors": {
      "origin": "*",
      "credentials": "true|false",
      "methods": ["GET", "PUT", "POST"],
      "allowedHeaders": ["Content-Type", "Authorization"],
      "exposedHeaders": ["Content-Range", "X-Content-Range"],
      "maxAge": 600
    }
  }

*/}
var pkg   = require('./package.json')
var argv  = require('minimist')(process.argv.slice(2));
var help  = require('@maboiteaspam/show-help')(usage, argv.h||argv.help, pkg)
var debug = require('@maboiteaspam/set-verbosity')(pkg.name, argv.v || argv.verbose);
var fs    = require('node-fs-extra')
var path  = require('path')

var configPath  = argv.config || argv.c || false;
const port  = argv.port || argv.p || 8091;
var config = {}

if (configPath) {
  configPath = path.resolve(process.cwd(), configPath);
  try{
    config = require(configPath)
  }catch(ex){
    help.die(
      "Config path must exist and be a valid JSON file.\n" + ex
    );
  }
  (!config) && help.print(usage, pkg)
  && help.die(
    "The configuration could not be loaded, please double check the file"
  );
}

if (!config.aliases) {
  config.aliases = {}
  if (config.base) {
    config.aliases = {
      "": config.base
    }
    delete config.base;
  }
}

if (!config.url_base) {
  config.url_base = "/"
}

if (!config.upload_path) {
  config.upload_path = "/tmp"
}

if (!config.clear) {
  config.clear = {
    host: '127.0.0.1',
    port: argv.port || argv.p || 8091
  }
}

Object.keys(config.aliases).forEach(function (alias){
  config.aliases[alias] = path.join(process.cwd(), config.aliases[alias])
  if (!fs.existsSync(config.aliases[alias])) {
    fs.mkdirSync(config.aliases[alias], '0755', true)
  }
})

if (config.ssl) {
  (!config.ssl.key && !config.ssl.cert)
  && help.print(usage, pkg)
  && help.die(
    "Configuration options are wrong : SSL requires a key and a cert"
  );
  (config.ssl.key && !fs.existsSync(config.ssl.key))
  && help.print(usage, pkg)
  && help.die(
    "Configuration options are wrong : SSL key file must exist"
  );

  (config.ssl.ca && config.ssl.ca && !fs.existsSync(config.ssl.ca))
  && help.print(usage, pkg)
  && help.die(
    "Configuration options are wrong : SSL ca file must exist"
  );

  (config.ssl.cert && !fs.existsSync(config.ssl.cert))
  && help.print(usage, pkg)
  && help.die(
    "Configuration options are wrong : SSL cert file must exist"
  );
}

if (!config.cors) {
  config.cors = {
    "origin": true,
    "credentials": true,
    "methods": ["GET", "PUT", "POST"],
    "maxAge": 600
  };
}


var http        = require('http');
var https       = require('https');
var express     = require('express');
var multer      = require('multer');
var bodyParser  = require('body-parser');
var cors        = require('cors');
var fileStore   = require('./index.js');

var upload = multer({ dest: config.upload_path });
var app = express();


console.log("http-file-store url_base %s", config.url_base);
console.log("http-file-store alias %j", config.aliases);
console.log("http-file-store allow_overwrite %s", config.allow_overwrite);
config.cors && console.log("http-file-store cors %j", config.cors);

config.cors && app.use(cors(config.cors));

if (config.aliases[""]) {
  app.get(config.url_base + "*", fileStore.read(config));
  app.post(config.url_base + "*", upload.single('file'), fileStore.write(config));
  if (config.allow_delete) {
    app.delete(config.url_base + "*", fileStore.unlink(config));
  }
} else {
  app.get(config.url_base, fileStore.root(config));
  app.get(config.url_base + ":alias/*", fileStore.read(config));
  app.post(config.url_base + ":alias/*", upload.single('file'), fileStore.write(config));
  if (config.allow_delete) {
    app.delete(config.url_base + ":alias/*", fileStore.unlink(config));
  }
}

if (config.configurable_alias) {
  app.get(config.url_base + "aliases", fileStore.aliases.get(config));
  app.post(config.url_base + "aliases/add/",
    bodyParser.urlencoded({extended: !true}), fileStore.aliases.add(config, configPath));
  app.post(config.url_base + "aliases/remove/",
    bodyParser.urlencoded({extended: !true}), fileStore.aliases.remove(config));
}

if (config.ssl && config.ssl.key && config.ssl.cert) {
  var SSL = https.createServer( {
      key:  fs.readFileSync( config.ssl.key ),
      cert: fs.readFileSync( config.ssl.cert ),
      ca:   config.ssl.ca || []
  }, app );

  console.log("http-file-store SSL host %s:%s", config.ssl.host || '0.0.0.0', config.ssl.port);

  SSL.listen(config.ssl.port, config.ssl.host);
}

var CLEAR = http.createServer( app );

CLEAR.listen(config.clear.port, config.clear.host);

console.log("http-file-store CLEAR host %s:%s", config.clear.host || '0.0.0.0', config.clear.port);

var tearDown = function (then) {
  CLEAR && CLEAR.close();
  SSL && SSL.close();
  process.exit(1)
}
process.on('beforeExit', tearDown)
process.on('SIGINT', tearDown)

var url     = require('url');
var path    = require('path');
var Emitter = require('micro-events');

EventEmitter.prototype.trigger = EventEmitter.prototype.emit;

function FSClient (opts) {

  var self = this;

  var remote = {
    protocol: 'http:',
    hostname: null,
    port: null,
    username: null,
    password: null,
    url_base: null,
  };

  // configuration
  self.setEndPoint = function (opts) {
    remote = opts;
  }
  self.endPointUrl = function (relativeUrl, query) {
    return remoteUrl(relativeUrl || '', query)
  }
  opts && self.setEndPoint(opts);

  var remoteUrl = function (relativeUrl, query) {
    var o = {
      protocol: remote.protocol,
      hostname: remote.hostname,
      port:     remote.port,
      query:    query,
      pathname: path.join(remote.url_base, '/', relativeUrl)
    };
    if (remote.username || remote.password) {
      o.auth = [remote.username, ':', remote.password].join('')
    }
    return url.format(o)
  }

  var xhrResponseHandler = function (xhr, then) {
    if(xhr.readyState === XMLHttpRequest.DONE) {
      var err;
      var res;
      if (xhr.status !== 200) {
        err = {
          status: xhr.status,
          reason: 'something to do'
        }
      } else {
        try{
          res = JSON.parse(xhr.responseText);
        } catch(ex) {
          err = {
            status: xhr.status,
            reason: ex
          }
        }
      }
      then && then(err, res);
    }
  }


  this.root = function (then) {
    var action = remoteUrl ('')

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(ev) {
      xhrResponseHandler(xhr, then);
    };
    xhr.open('GET', action, true);
    xhr.send();
  }

  this.read = function (path, then) {
    var action = remoteUrl (path)

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(ev) {
      xhrResponseHandler(xhr, then);
    };
    xhr.open('GET', action, true);
    xhr.send();
  }

  this.write = function (path, html5File, then) {
    var progresser = new Emitter();
    var action = remoteUrl (path);

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(ev) {
      xhrResponseHandler(xhr, function (err, res) {
        err && progresser.trigger('error', err);
        progresser.trigger('end');
        then && then(err, res);
      });
    };
    var started = false;
    xhr.upload.addEventListener('progress', function (ev) {
      if(!started) progresser.trigger('start', ev);
      started = true;
      progresser.trigger('progress', ev);
    }, false);
    xhr.open('POST', action, true);
    var data = new FormData();
    data.append('file', html5File);
    xhr.send(data);
    return progresser;
  }

  this.overwrite = function (path, html5File, then) {
    var progresser = new Emitter();
    var action = remoteUrl (path, {overwrite: 1})

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(ev) {
      xhrResponseHandler(xhr, function (err, res) {
        err && progresser.trigger('error', err);
        progresser.trigger('end');
        then && then(err, res);
      });
    };
    var started = false;
    xhr.upload.addEventListener('progress', function (ev) {
      if(!started) progresser.trigger('start', ev);
      started = true;
      progresser.trigger('progress', ev);
    }, false);
    xhr.open('POST', action, true);
    var data = new FormData();
    data.append('file', html5File);
    xhr.send(data);
    return progresser;
  }

  this.unlink = function (path, recursive, then) {
    var action = remoteUrl (path, {recursive: recursive?1:null})

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(ev) {
      xhrResponseHandler(xhr, then);
    };
    xhr.open('DELETE', action, true);
    xhr.send();
  }

  this.mkdir = function (path, name, then) {
    var action = remoteUrl (path)

    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(ev) {
      xhrResponseHandler(xhr, then);
    };
    xhr.open('POST', action, true);
    var data = new FormData();
    data.append('name', name);
    xhr.send(data);
  }
}

module.exports = FSClient;

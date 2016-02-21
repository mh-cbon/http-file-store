# http-file-store

Server and api to read / write files over HTTP.

# binary

`http-file-store` is a stand alone web server which provides
an api to read / write a file system over HTTP.

### install
```
npm i -g mh-cbon/http-file-store
```

### usage
```
http-file-store 1.0.0
  Server and api to read / write files over http

Usage

  http-file-store --config=/path/to/config.json

Options

  --config  | -c   Path to the JSON configuration file
  --verbose | -v   Enable verbosity pass in the module list to debug.

Config

  The configuration is a plain json object describing several options to
  apply to your instance of http-file-store.

  {
    "base": "/path/to/the/directory/to/read/write/files",
    "url_base": "/base/url/to/serve/files",
    "upload_path": "/base/to/temp/uploaded/files",
    "ssl": {
      "port": "a number, or null for a random port",
      "host": "a host value to listen for https requests",
      "key": "a path to an SSL key",
      "ca": "a path to the SSL CA file",
      "cert": "a path to the SSL cert file",
    },
    "clear": {
      "port": "a number, or null for a random port",
      "host": "a host value to listen for http requests",
    }
  }
```

# api

`http-file-store` can also be consumed as a module of your project.
It provides two middlewares to use within an express application.

### Example

```js

var fileStore = require('http-file-store');
var upload    = multer({ dest: config.upload_path });
var app       = express();

// provide a read access, much like serve-static,
// but it returns JSON responses for directories.
app.get(config.base_url, fileStore.read(config.base));

// provide write access, use multer to manage file uploads.
app.post(config.base_url,
  upload.single('file'),
  fileStore.write(config.base, config.allowOverwrite));

```

# http api

`http-file-store` can read files based on url path.

### Read

Given a route mounted on `/read`, and a file `some.txt`
 on the root of `config.base` directory:

 ```js
 request(app)
   .get('/read/some.txt')
   .expect('Content-Type', /text/)
   .expect(200, /content/)
   .end(done)
 ```

### Write

Given a route mounted on `/write`, and file `other.txt` to write
 on the root of `config.base` directory:

```js
request(app)
  .post('/write/')
  .attach('file', path.join('other.txt'))
  .expect(200)
```


# Read more

- https://github.com/andyburke/node-storehouse
- http://expressjs.com/en/api.html
- https://nodejs.org/api/https.html
- https://github.com/expressjs/multer

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
    "show_absolute_path": true|false,
    "allow_overwrite": true|false,
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
      "methods": ['GET', 'PUT', 'POST'],
      "allowedHeaders": ['Content-Type', 'Authorization'],
      "exposedHeaders": ['Content-Range', 'X-Content-Range'],
      "maxAge": 600
    }
  }
```

# express handlers

`http-file-store` can also be consumed as a module of your project.
It provides two handlers to use with an express application.

### Example

```js

var fileStore = require('http-file-store');
var upload    = multer({ dest: config.upload_path });
var app       = express();

// provide a read access, much like serve-static,
// but it returns JSON responses for directories.
app.get(config.base_url, fileStore.read(config));

// provide write access, using multer to manage file uploads.
app.post(config.base_url,
  upload.single('file'),
  fileStore.write(config));

```

# http api

`http-file-store` can read files based on url path.

### Read

##### A file

Given a route mounted on `/read`, and a file `some.txt`
 on the root of `config.base` directory:

 ```js
 request(app)
   .get('/read/some.txt')
   .expect('Content-Type', /text/)
   .expect(200, /content/)
   .end(done)
 ```

 When the target path provided within the url path is a `file`, the content
 is streamed to the client.

##### A directory

 When the target path provided within the url path is a `directory`,
  the listing of the directory is provided as a JSON object such:

  ```js
  [
    {
      name:   f,
      type:   stats.isFile() ? 'file' : 'dir',
      size:   stats.size,
      mime:   mime.lookup(path.join(filePath, f)) || 'application/octet-stream',
      atime:  stats.atime,
      mtime:  stats.mtime,
      ctime:  stats.ctime,
      birthtime: stats.birthtime,
      // only if config.show_absolute_path is true
      absolute_path: path.resolve(path.join(filePath, f))
    }
  ]
  ```

### Write

Given a route mounted on `/write`, and file `other.txt` to write
 on the root of `config.base` directory:

```js
request(app)
  .post('/write/')
  .attach('file', 'other.txt')
  .expect(200)
```

On successful write, the route handler will return the new listing of the
directory, much like a read access:

```js
[
  {
    name:   f,
    type:   stats.isFile() ? 'file' : 'dir',
    size:   stats.size,
    mime:   mime.lookup(path.join(filePath, f)) || 'application/octet-stream',
    atime:  stats.atime,
    mtime:  stats.mtime,
    ctime:  stats.ctime,
    birthtime: stats.birthtime,
    // only if config.show_absolute_path is true
    absolute_path: path.resolve(path.join(filePath, f))
  }
]
```

##### Overwriting

When `config.json` file is configured to allow overwrite,

```json
  {
    "allow_overwrite": true,
  }
```

You may overwrite a file by sending an extra __query__ parameter with the POST request,

```js
request(app)
  .post('/write/?overwrite=1')
  .attach('file', 'other.txt')
  .expect(200)
```

# Todos

- ~~add range support for file streaming would be great.~~
- multiple file uploads at once

# Read more

- https://github.com/andyburke/node-storehouse
- http://expressjs.com/en/api.html
- https://nodejs.org/api/https.html
- https://github.com/expressjs/multer

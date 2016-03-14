# http-file-store

Server and api to read / write files over HTTP.

# binary

`http-file-store` is a stand alone web server which provides
an api to manipulate a file system over HTTP.

### install
```
npm i -g mh-cbon/http-file-store
```

### usage
```
http-file-store 1.0.0
  Server and api to manipulate a file system over http

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
    "url_base": "/base/url/to/serve/files/ending/with/a/slash",
    "upload_path": "/path/to/temp/uploaded/files",
    "show_absolute_path": true|false,
    "allow_overwrite": true|false,
    "allow_delete": true|false,
    "configurable_alias": true|false,
    "aliases": {
      "alias_name": "/path/to/the/directory/to/read/write/files"
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
      "methods": ['GET', 'PUT', 'POST'],
      "allowedHeaders": ['Content-Type', 'Authorization'],
      "exposedHeaders": ['Content-Range', 'X-Content-Range'],
      "maxAge": 600
    }
  }
```

# express handlers

`http-file-store` can also be consumed as a module of your project.
It provides multiple handlers to use with an express application.

### Example

```js

var fileStore = require('http-file-store');
var upload    = multer({ dest: config.upload_path });
var app       = express();

// provide a read access, much like serve-static,
// but it returns JSON responses for directories.
app.get(config.url_base + ":alias/*", fileStore.read(config));

// provide write access, using multer to manage file uploads.
app.post(config.url_base + ":alias/*", upload.single('file'), fileStore.write(config));

// provide delete access, using multer to manage file uploads.
app.delete(config.url_base + ":alias/*", fileStore.unlink(config));

```

### Configuration

The configuration is set via a `config.json` file defined from the command line invocation with `-c|--config` parameter.


##### Setting the root paths to serve

To set the root path of the file system managed via the API, you can define those options:

##### Set base option

`base: "/path/to/serve/"` will define a unique file system entry point to serve.

Note: Internally it is transformed into an alias such `{alias:{"":"/path/"}}`

Note2: `base` and `alias` directives are exclusive.

##### Define multiple alias

Alternatively to the `base` directive, you can define an `alias` object of `path` to serve, such

```json
alias: {
  "name": "path",
  "name1": "path1",
}
```

Doing so enable you to serve multiple root directories.

To fetch the list of alias, you can query `/`.

To fetch the content of an alias, you can query `/my_alias/` and so on.

# http api

`http-file-store` can manipulate files based on url path of the query.

### Read

##### A file

Given a route mounted on `/read`, and a file `some.txt`
on the root of an `empty` aliased directory (`{alias:{"":"/path/"}}`):

 ```js
 request(app)
   .get('/read/some.txt')
   .expect('Content-Type', /text/)
   .expect(200, /content/)
   .end(done)
 ```

When the target path provided within the url path is recognized as a `file`,
the content is streamed to the client.

You may force file download by sending an extra __query__ parameter with the POST request,

```js
request(app)
  .post('/write/?download=1')
  .expect('Content-Disposition', /attachment/)
  .expect(200)
```

##### A directory

When the target path provided within the url path is recognized as a `directory`,
the listing of the directory is returned as a JSON object such:

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
      // only when config.show_absolute_path is true
      absolute_path: path.resolve(path.join(filePath, f))
    }
  ]
  ```

### Write

Given a route mounted on `/write`, and a file `other.txt` to write
on the root of an `empty` aliased directory (`{alias:{"":"/path/"}}`):

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

### Delete

You can enable a route to delete items by adding `allow_delete: true` to the configuration.

##### A file

Given a route mounted on `/delete`, and a file `some.txt` to delete
on the root of an `empty` aliased directory (`{alias:{"":"/path/"}}`):

```js
request(app)
  .delete('/delete/some.txt')
  .expect(200)
```

On successful delete, the route handler will return the new listing of the
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

##### A directory

You can delete a directory too, if the directory is not empty,
you shall send an extra query parameter
`recursive=1` to recursively delete a directory.

```js
request(app)
  .delete('/delete/other/?recursive=1')
  .expect(200)
```

On successful delete, the route handler will return the new listing of the
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

### Configure aliases

When `config.configurable_alias` is true, the binary will add new routes to
get / add / remove aliases.

##### Get

Given a route mounted on `/aliases`, retrieve aliases object as a JSON response.

```js
request(app)
  .get('/aliases/')
  .expect('Content-Type', /json/)
  .expect(200)
```

##### Add

Given a route mounted on `/add`, you may add an alias to the current
configuration by doing a POST request with an `alias` and a `path` fields.

```js
request(app)
  .post('/add/')
  .field('alias', 'name')
  .field('path', 'path of the alias')
  .expect(200)
```

You may persist the new configuration by sending an extra __query__ parameter with the POST request,

```js
request(app)
  .post('/add/?persist=1')
  .field('alias', 'name')
  .field('path', 'path of the alias')
  .expect(200)
```

##### Remove

Given a route mounted on `/remove`, you may remove an `alias` of the current
configuration by doing a POST request with an `alias` fields.

```js
request(app)
  .post('/remove/')
  .field('alias', 'name')
  .expect(200)
```

You may persist the new configuration by sending an extra __query__ parameter with the POST request,

```js
request(app)
  .post('/remove/?persist=1')
  .field('alias', 'name')
  .expect(200)
```

# Todos

- ~~add range support for file streaming would be great.~~
- multiple file uploads at once
- change write method of the bin from POST to PUT
- provide built in client to consume the API
- finish the tests about aliases management

# Read more

- https://github.com/andyburke/node-storehouse
- http://expressjs.com/en/api.html
- https://nodejs.org/api/https.html
- https://github.com/expressjs/multer

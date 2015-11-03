var util = require('util');
var http = require('http');
var https = require('https');
var url = require('url');
var htmlparser = require("htmlparser2");

// var expression = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi;
var expression = /(http(s)?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b[-a-zA-Z0-9@:%_\+.~#?&\/=]*/gi
var regex = new RegExp(expression);

var externUrl = /http(s)?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b[-a-zA-Z0-9@:%_\+.~#?&\/=]*/gi
var regexExternUrl = new RegExp(externUrl);

var timeout = 5000;

var currentFetch = 0;
var fetched = {};
var stats = {
  fetch: 0,
  hostname: 0,
  redirection: 0,
  error: { dns: 0, timeout: 0, other: 0 },
  start: Date.now()
};

var filters = [
  new RegExp('[^?]+\.jpg($|[?].*)'),
  new RegExp('[^?]+\.png($|[?].*)'),
  new RegExp('[^?]+\.jpeg($|[?].*)'),
  new RegExp('^[a-z]+to:.*'),
  new RegExp('^tel:.*'),
  new RegExp('^irc:.*'),
  new RegExp('^javascript:.*')
];

process.on('exit', function() {
  stats.end = Date.now();
  stats.duration = stats.end - stats.start;
  printStats();
});
process.on('SIGINT', function() {
  process.exit(0);
}); // catch ctrl-C to quit clean

function parse(data) {
  var links = [];
  var parser = new htmlparser.Parser({
    onopentag: function(name, attribs){
      if(name === "a" && attribs.href &&
        attribs.href.indexOf('#') !== 0) {
          links.push({ url: attribs.href, type: 'a' });
      }
      if(name === "form" && attribs.action &&
        attribs.action.indexOf('#') !== 0) {
          links.push({ url: attribs.action, type: 'form' });
      }
    },
    ontext: function(text) {
      var match = text.match(regexExternUrl);
      if (match && match.length > 0) {
        match.forEach(function(url) {
          links.push({ url: url, type: 'text' });
        });
      }
    },
    onclosetag: function(tagname) {}
  }, { decodeEntities: true });options.hostname + options.path
  parser.write(data);
  parser.end();
  return links;
}

function hasHeader(header, headers) {
  var headers = Object.keys(headers);
   var lheaders = headers.map(function (h) { return h.toLowerCase(); });
  header = header.toLowerCase()
  for (var i=0; i < lheaders.length; ++i) {
    if (lheaders[i] === header) return headers[i];
  }
  return false;
}

function fetch(options, cb) {
  options.agent = false;
  var transport;
  if (options.protocol === 'https:') {
  transport = https;
  options.rejectUnauthorized = false;
  } else {
  transport = http;
  }
  try {
    var req = transport.request(options, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        var location = hasHeader('location', res.headers);
        if (location) {
          // console.log('***** redirection', location);
          stats.redirection = ++stats.redirection;
          run(url.parse(location));
        }
      }
      var data = "";
      res.setEncoding('utf8');
      res.on('data', function(d) { data += d; });
      res.on('end', function() { cb(null, data); });
    });
    req._implicitHeader = function() {
      this._storeHeader(this.method + ' ' + this.path + ' HTTP/1.0\r\n',
        this._renderHeaders());
    };
    var hasTimeout = false;
    req.on('error', function(err) { hasTimeout ? cb('timeout') : cb(err); });
    req.on('socket', function(socket) {
      socket.setTimeout(timeout);  
      socket.on('timeout', function() {
        hasTimeout = true;
        req.abort();
      });
    });
    req.end();
  } catch (err) { cb(err); }
}

function filtered(options) {
  for (index = 0; index < filters.length; ++index) {
    if (filters[index].test(options.href)) {
      // console.log('***** filtered', options.href);
      return true;
    }
  }
  return false;
}

function insertFetched(options) {
  var site = fetched[options.hostname];
  if (!site) {
    site = fetched[options.hostname] = {};
    stats.hostname = stats.hostname + 1;
  }
  site[options.path] = 1;
}

function isAlreadyFetched(options) {
  var site = fetched[options.hostname];
  if (!site) {
    return false;
  }
  return site[options.path];
}

function printStats() {
  console.log('\n***********\n** Stats **\n***********\n');
  console.log(JSON.stringify(stats, null, '\t'));
  console.log('time:', stats.duration / 1000, 'sec');
}

var limit = -1;
var fetchIndex = 0;

function run(options) {
  if (!options.hostname) { return; }
  if (filtered(options)) { return; }
  if (isAlreadyFetched(options)) { return; }
  if (limit != -1 && fetchIndex >= limit) { return; }
  ++fetchIndex;
  stats.fetch = ++stats.fetch;
  ++currentFetch;
  fetch(options, function(err, data) {
  // console.log('***** fetched:', options.href);
  --currentFetch;
    if (err) {
      if (err === 'timeout') {
        stats.error.timeout = ++stats.error.timeout;
      } else if (err.code === 'ENOTFOUND' && err.syscall === 'getaddrinfo') {
        stats.error.dns = ++stats.error.dns;
      } else {
        stats.error.other = ++stats.error.other;
        console.log('***** error', options.href, err);
      }
    } else {
      insertFetched(options);
      var links = parse(data);
      links.forEach(function(link) {
        if (link.url) { run(url.parse(link.url)); }
      });
    }
   });
}

var options = url.parse('http://www.sedona.fr');
run(options);

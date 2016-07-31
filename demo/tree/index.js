var request = require('../lib/request.js');
var createRenderer = require('./renderer.js');
var collectPaths = require('../../lib/collectPaths.js');
var getRectFromName = require('../../lib/getRectFromName.js');
var _ = require('lodash');
var groups;
var labels;
var tree;
var cache = {};

var renderer = createRenderer(document.body, getGroup)
renderer.on('positionChanged', _.throttle(update, 30));

//var currentChunks = new Set();
var pendingLoad = new Set();
request('data/tree.json', {responseType: 'json'}).then(function(jsonTree) {
  tree = jsonTree;

  return getQuad('0').then(function (points) {
    // currentChunks.add('0');
    renderer.append('0', points);
  });
})

request('groups.yt.bin', {responseType: 'arraybuffer'}).then(function(g) {
  groups = new Int16Array(g);
});

request('labels.yt.json', {responseType: 'json'}).then(function(data) {
  labels = data;
});

function update(cameraRect) {
  var paths = collectPaths({
    left: cameraRect.left,
    right: cameraRect.right,
    top: cameraRect.top,
    bottom: cameraRect.bottom,
  }, tree);
  var chunksToRemove = [];
  var chunksToLoad = [];

  // lastRequest += 1;
  // if (lastRequest > 1000) lastRequest = 0;

  var currentChunks = renderer.getCurrentChunks();
  currentChunks.forEach(function(value, key) {
    if (!paths.has(key)) chunksToRemove.push(key);
  });

  paths.forEach(function(path) {
    if (currentChunks.has(path)) return;
    if (pendingLoad.has(path)) return;

    chunksToLoad.push(path);
  });

  chunksToRemove.forEach(function(chunk) {
    pendingLoad.delete(chunk);
  //  currentChunks.delete(chunk);
  });

  chunksToLoad.forEach(function(chunk) {
    pendingLoad.add(chunk);

    getQuad(chunk).then(function(points) {
      if (pendingLoad.has(chunk)) {
        renderer.append(chunk, points);
        pendingLoad.delete(chunk);
      }
    });
  });
}

function getQuad(name) {
  if (cache[name]) {
    return Promise.resolve(cache[name]);
  }
  return request('data/' + name + '.bin', {
    responseType: 'arraybuffer',
  }).then(function (points) {
    return parseQuad(points, name);
  });
  // .then(function(points) {
  //   cache[name] = points;
  //   return points;
  // });
}

function parseQuad(buffer, name) {
  var src = new Int32Array(buffer);
  var points = [];

  for (var i = 0; i < src.length; i += 4) {
    var x = src[i + 1];
    var y = src[i + 2];
    var area = src[i + 3];
    var r = Math.sqrt(area / Math.PI);
    r = Math.max(5, r);

    points[i/4] = {
      id: src[i],
      x: x,
      y: y,
      r: r
    };
  }
  var rect = getRectFromName(name, tree.rect);

  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    points: points
  };
}


function getGroup(id) {
  if (groups) {
    return groups[id];
  }
  return 0;
}

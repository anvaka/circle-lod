var initCollapseTree = require('../../lib/initCollapseTree.js');
var initNodes = require('../../lib/initNodes.js');
var rectAIntersectsB = require('../../lib/rectAIntersectsB.js');

var createQuadFS = require('./quadFS.js');

var fs = require('fs');
var path = require('path');
var outFolder = path.join(__dirname, 'data');
var quadFS = createQuadFS(outFolder);

var labelsFileName = path.join(__dirname, '..', 'labels.json');
var labelsText = fs.readFileSync(labelsFileName, 'utf8');

// TODO: This will not scale to many millions (node had cap of ~300MB?)
var labels = JSON.parse(labelsText);

var fname = process.argv[2] || path.join(__dirname, '..', 'positions-s.yt.2d.bin');
var buffer = toArrayBuffer(fs.readFileSync(fname));
var positions = new Int32Array(buffer);

var src = initNodes(positions);
var rankInfo = initCollapseTree(positions);
var tree = rankInfo.tree;
var levels = rankInfo.levels;

var root = create(tree._root);
root.rect = {
  left: tree._root.left,
  top: tree._root.top,
  right: tree._root.right,
  bottom: tree._root.bottom
}

appendTo(root, tree._root, '0');
quadFS.saveTreeIndex(root);

console.log('All done');

function appendTo(root, treeNode, path) {
  saveTopQuads(treeNode, path);

  if (path.length < levels.length) {
    for (var i = 0; i < treeNode.length; ++i) {
      var node = treeNode[i];
      if (node) {
        root.children[i] = create(node);
        appendTo(root.children[i], node, path + i);
      }
    }
  }
}

function saveTopQuads(treeNode, path) {
  var levelIndex = levels.length - path.length;
  var level = levels[levelIndex];
  if (!level) throw new Error('no level provided for ' + levelIndex);

  var nextLevel = levelIndex === 0 ? level : levels[levelIndex - 1];

  var visibleNodes = findVisibleNodesOnLevelInRect(level, treeNode, path, nextLevel);
  saveQuad(path, visibleNodes);
}

function findVisibleNodesOnLevelInRect(level, rect, path, nextLevel) {
  var visibleNodes = [];
  var visibleOnNextLevelCount = 0

  tree.visit(function(node, left, top, right, bottom) {
    if (!rectAIntersectsB(rect, {
      left: left,
      top: top,
      right: right,
      bottom: bottom
    })) {
      // this quad does not even intersect our rect. no need to traverse further
      return true;
    }


    if (!node.length) {
      // okay, this is not intermediate node. Just check that it belongs to
      // this level and add it:
      var q = node;
      do {
        var nodeId = q.data.i;
        if (nodeId === undefined) throw new Error('id should be defined at this point');

        if (level.has(nodeId)) {
          visibleNodes.push(q.data);
        } else if (nextLevel.has(nodeId)) {
          visibleOnNextLevelCount += 1;
        }
      } while(q = q.next);
    }
  });

  console.log('path: ' + path
              + ', visible in rect: ' + visibleNodes.length
              + ', visible on next: ' + visibleOnNextLevelCount
              + ', ratio this/next: ' + visibleNodes.length/visibleOnNextLevelCount
             );

  return visibleNodes;
}

function saveQuad(name, quadElements) {
  var serializedPositions = new Buffer(quadElements.length * 4 * 4);
  var labelsInQuad = Object.create(null);

  quadElements.forEach(serializePositionToBuffer);

  quadFS.appendQuad(name, serializedPositions, labelsInQuad);

  return;

  function serializePositionToBuffer(quad, i) {
    labelsInQuad[quad.i] = labels[quad.i];

    var idx = i * 4 * 4;
    var node = src[quad.i];
    var nodeId = quad.i;

    var area = Math.PI * node.r * node.r;

    serializedPositions.writeInt32LE(nodeId, idx);
    serializedPositions.writeInt32LE(quad.x, idx + 4);
    serializedPositions.writeInt32LE(quad.y, idx + 8);
    serializedPositions.writeInt32LE(Math.round(area), idx + 12);
  }
}

function create(q) {
  var node = {}
  if (q.length) node.children = {};

  return node;
}

function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }

    return ab;
}

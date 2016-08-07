var initCollapseTree = require('../../lib/initCollapseTree.js');
var initNodes = require('../../lib/initNodes.js');
var rectAIntersectsB = require('../../lib/rectAIntersectsB.js');
var mkdirp = require('mkdirp');

var fs = require('fs');
var path = require('path');
var outFolder = path.join(__dirname, 'data');

var positionsFolder = path.join(outFolder, 'positions');
mkdirp.sync(positionsFolder);

var labelsFolder = path.join(outFolder, 'labels');
mkdirp.sync(labelsFolder);

var labelsFileName = path.join(__dirname, 'labels.json');
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

fs.writeFileSync(path.join(outFolder, 'tree.json'), JSON.stringify(root), 'utf8')
console.log('All done');

function appendTo(root, treeNode, path) {

  saveTopQuads(treeNode, path);

  if (path.length < levels.length) {
    for (var i = 0; i < treeNode.length; ++i) {
      var q = treeNode[i];

      if (q) {
        // the entire quad has more nodes than max allowed nodes. Split it.
        root.children[i] = create(q);
        appendTo(root.children[i], q, path + i);
      }
    }
  }
}

function saveTopQuads(treeNode, path) {
  var levelIndex = levels.length - path.length;
  var level = levels[levelIndex];
  if (!level) throw new Error('no level provided for ' + levelIndex);

  var visibleNodes = findVisibleNodesOnLevelInRect(level, treeNode);
  saveQuad(path, visibleNodes);
}



function findVisibleNodesOnLevelInRect(level, rect) {
  var visibleNodes = [];

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

        if (level.has(nodeId)) visibleNodes.push(q.data);
      } while(q = q.next);
    }
  });

  return visibleNodes;
}

function saveQuad(name, quadElements) {
  savePositions(name, quadElements)
  saveLabels(name, quadElements)
}

function saveLabels(name, quadElements) {
  var labelsFileName = path.join(labelsFolder, name + '.json');
  console.log('saving ' + labelsFileName);
  var labelsInQuad = Object.create(null);

  quadElements.forEach(function(quad) {
    labelsInQuad[quad.i] = labels[quad.i];
  });

  fs.writeFileSync(labelsFileName, JSON.stringify(labelsInQuad), 'utf8');
}

function savePositions(name, quadElements) {
  var positionFileName = path.join(positionsFolder, name + '.bin');
  console.log('saving ' + positionFileName);

  var buf = new Buffer(quadElements.length * 4 * 4);

  quadElements.forEach(function(quad, i) {
    var idx = i * 4 * 4;
    var node = src[quad.i];
    var nodeId = quad.i;

    var area = Math.PI * node.r * node.r;

    buf.writeInt32LE(nodeId, idx);
    buf.writeInt32LE(quad.x, idx + 4);
    buf.writeInt32LE(quad.y, idx + 8);
    buf.writeInt32LE(Math.round(area), idx + 12);
  });

  fs.writeFileSync(positionFileName, buf);
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

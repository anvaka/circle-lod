var initCollapseTree = require('../../lib/initCollapseTree.js');
var initNodes = require('../../lib/initNodes.js');
var rectAIntersectsB = require('../../lib/rectAIntersectsB.js');

var fs = require('fs');
var path = require('path');
var outFolder = path.join(__dirname, 'data');

var fname = process.argv[2] || path.join(__dirname, '..', 'positions-s.yt.2d.bin');
var buffer = toArrayBuffer(fs.readFileSync(fname));
var positions = new Int32Array(buffer);

var src = initNodes(positions);
var layers = initCollapseTree(positions);
var tree = layers[0].tree;

var root = create(tree._root);
root.rect = {
  left: tree._root.left,
  top: tree._root.top,
  right: tree._root.right,
  bottom: tree._root.bottom
}

debugger;
appendTo(root, tree._root, '0');


fs.writeFileSync(path.join(outFolder, 'tree.json'), JSON.stringify(root), 'utf8')
console.log('All done');

function appendTo(root, treeNode, path) {
  // if (!treeNode.length) {
  //   throw new Error('Impossible!');
  // }

  saveTopQuads(treeNode, path);

  if (path.length < layers.length - 1) {
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
  var layerTree = layers[layers.length - path.length].tree;
  var topQuads = getTopQuads(layerTree, treeNode);
  savePositions(getName(path), topQuads);
}


function getName(localName) {
  return path.join(outFolder, localName + '.bin');
}

function getTopQuads(tree, rect) {
  var quads = [];

  tree.visit(function(node, left, top, right, bottom) {
    if (!rectAIntersectsB(rect, {
      left: left,
      top: top,
      right: right,
      bottom: bottom
    })) return true;

    if (!node.length) {
      var q = node;
      do {
        quads.push(q.data);
      } while(q = q.next);
    }
  });

  return quads;
}

function savePositions(name, positions) {
  console.log('saving ' + name);

  var buf = new Buffer(positions.length * 4 * 4);

  positions.forEach(function(p, i) {
    var idx = i * 4 * 4;
    var node = src[p.i];
    var nodeId = p.i;

    var area = Math.PI * node.r * node.r;

    buf.writeInt32LE(nodeId, idx);
    buf.writeInt32LE(p.x, idx + 4);
    buf.writeInt32LE(p.y, idx + 8);
    buf.writeInt32LE(Math.round(area), idx + 12);
  });

  fs.writeFileSync(name, buf);
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

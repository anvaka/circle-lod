var initTree = require('../../lib/initTree.js');
var getTopQuads = require('../../lib/getTopQuads.js');
var fs = require('fs');
var path = require('path');

var outFolder = path.join(__dirname, 'data');

var fname = process.argv[2] || path.join(__dirname, '..', 'positions.yt.2d.bin');
var buffer = toArrayBuffer(fs.readFileSync(fname));

var maxNodes = 4096;
var positions = new Int32Array(buffer);

var tree = initTree(positions);

var root = create(tree._root);
root.rect = {
  left: tree._root.left,
  top: tree._root.top,
  right: tree._root.right,
  bottom: tree._root.bottom
}

appendTo(root, tree._root, '0', maxNodes);

fs.writeFileSync(path.join(outFolder, 'tree.json'), JSON.stringify(root), 'utf8')
console.log('All done');

function appendTo(root, treeNode, path, maxNodes) {
  if (!treeNode.length) {
    throw new Error('Impossible!');
  }

  saveTopQuads(treeNode, path, maxNodes);
  var hasSiblingWithLessThanMaxNodes = false;
  var i, q;

  for (i = 0; i < treeNode.length; ++i) {
    q = treeNode[i];

    if (q && q.count <= maxNodes) {
      hasSiblingWithLessThanMaxNodes = true;
    }
  }

  var localNodeLimit = hasSiblingWithLessThanMaxNodes ? maxNodes * 3 : maxNodes;
  for (i = 0; i < treeNode.length; ++i) {
    q = treeNode[i];

    if (q) {
      if (q.count > localNodeLimit) {
        // the entire quad has more nodes than max allowed nodes. Split it.
        root.children[i] = create(q);
        appendTo(root.children[i], q, path + i, localNodeLimit);
      } else {
        saveTopQuads(q, path + i, localNodeLimit);
        root.children[i] = {};
      }
    }
  }
}

function saveTopQuads(treeNode, path, maxNodes) {
  var topQuads = getTopQuads(tree, {
    left: treeNode.left,
    right: treeNode.right,
    top: treeNode.top,
    bottom: treeNode.bottom,
  }, maxNodes);

  savePositions(getName(path), topQuads);
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

function savePositions(name, positions) {
  console.log('saving ' + name);

  var buf = new Buffer(positions.length * 4 * 4);

  positions.forEach(function(p, i) {
    var idx = i * 4 * 4;
    var nodeId = (p.largest || p).data.i;

    buf.writeInt32LE(nodeId, idx);
    buf.writeInt32LE(p.x, idx + 4);
    buf.writeInt32LE(p.y, idx + 8);
    buf.writeInt32LE(Math.round(p.area), idx + 12);
  });

  fs.writeFileSync(name, buf);
}

function getName(localName) {
  return path.join(outFolder, localName + '.bin');
}

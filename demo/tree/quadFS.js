var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var binaryDumpTreeUtils = require('../../lib/binaryDumpTree.js');
var encodeQuadNameToBinary = require('../../lib/binaryQuadName.js').encodeQuadNameToBinary;

module.exports = createQuadFS;

var saveThreshold = 32 * 1024;

function createQuadFS(quadFSDir) {
  var positionsDir = makeQuadDir('positions');
  var labelsDir = makeQuadDir('labels');

  var treeRoot = {
    selfByteLength: 0,
    childrenByteLength: 0
  };

  var api = {
    saveTreeIndex: saveTreeIndex,
    appendQuad: appendQuad,
  };

  return api;

  function saveTreeIndex(root) {
    var uint32Array = binaryDumpTreeUtils.binaryEncodeTree(root);
    // 4 int 32 for left/top/right/bottom
    // + binary tree itself
    // + terminal nodes index.
    var terminalNodeNames = flush()
    var bufferSize = (4 + uint32Array.length + terminalNodeNames.length) * 4;

    var treeBuffer = Buffer.alloc(bufferSize);

    // offset 0 to 4 * 4 - store root quad dimensions (left/top/right/bottom)
    var offset = 0;
    treeBuffer.writeInt32LE(root.rect.left, offset); offset += 4;
    treeBuffer.writeInt32LE(root.rect.top, offset); offset += 4;
    treeBuffer.writeInt32LE(root.rect.right, offset); offset += 4;
    treeBuffer.writeInt32LE(root.rect.bottom, offset); offset += 4;

    // reminder of the file is binary encoded index of children.
    var i = 0;
    for (i = 0; i < uint32Array.length; ++i) {
      treeBuffer.writeUInt32LE(uint32Array[i], offset);
      offset += 4;
    }

    // write down terminal nodes (nodes too small to have individual files)
    for (i = 0; i < terminalNodeNames.length; ++i) {
      var binaryName = toBinaryEncodedName(terminalNodeNames[i]);
      treeBuffer.writeUInt32LE(binaryName, offset);
      offset += 4;
    }
    fs.writeFileSync(path.join(quadFSDir, 'tree.bin'), treeBuffer);
  }

  function appendQuad(quadName, buffer, labels) {
    var quad = createQuad(quadName, buffer, labels);
    saveQuadIfNeeded(quad);
  }

  function createQuad(quadName, buffer, labels) {
    var quad = treeRoot;
    var byteLength = buffer.byteLength;

    quad.childrenByteLength += byteLength;

    for (var i = 1; i < quadName.length; ++i) {
      var quadId = quadName[i];
      var child = quad[quadId]
      if (!child) {
        child = {
          childrenByteLength: byteLength,
          selfByteLength: 0
        };

        quad[quadId] = child;
      } else {
        child.childrenByteLength += byteLength;
      }

      quad = child;
      saveQuadIfNeeded(child)
    }

    quad.selfByteLength = byteLength;
    quad.name = quadName;
    quad.buffer = buffer;
    quad.labels = labels;

    return quad;
  }

  function saveQuadIfNeeded(quad) {
    var buffer = quad.buffer;
    if (!buffer) return;

    if (buffer.byteLength >= saveThreshold || quad.childrenByteLength >= saveThreshold) {
      saveQuad(quad);
    }
  }

  function saveQuad(quad) {
    var positionsFileName = path.join(positionsDir, quad.name + '.bin');

    console.log('saving ' + positionsFileName);
    fs.writeFileSync(positionsFileName, quad.buffer);

    var labelsFileName = path.join(labelsDir, quad.name + '.json');
    console.log('saving ' + labelsFileName);
    fs.writeFileSync(labelsFileName, JSON.stringify(quad.labels), 'utf8');

    // release memory
    quad.buffer = null;
    quad.labels = null;
  }

  function flush() {
    var terminalLayers = [];

    collectTerminalLayersAndFlushLeaves(treeRoot);

    terminalLayers.forEach(storeTerminalQuad);

    return terminalLayers;

    function storeTerminalQuad(quad) {
      quad.buffer = serializeBuffersSubtree(quad);
      quad.labels = serializeLabelsSubtree(quad);
      saveQuad(quad);
    }

    function serializeLabelsSubtree(quad) {
      var result = Object.create(null);

      appendLabels(quad);

      return result;

      function appendLabels(quad) {
        result[quad.name] = quad.labels;
        for (var i = 0; i < 4; ++i) {
          if (quad[i]) appendLabels(quad[i]);
        }
      }
    }

    function serializeBuffersSubtree(quad) {
      var childrenCount = getChildrenCount(quad)
      // The head of the buffer contains offsets information.
      // Count of children (including self) - 4 bytes,
      // [
      // tuple:
      //   - encodedBinary quad name - 4 bytes,
      //   - offset where quad buffer is written - 4 bytes
      // ...
      // ],
      // giant blob of buffers concatenated together. To find buffer's size
      // just substruct its offset from the previous offset.
      var indexLength = childrenCount * 2 * 4;
      var result = new Buffer(4 + indexLength + quad.childrenByteLength)

      result.writeInt32LE(indexLength, 0); // how big is the index.

      var currentIndexOffset = 4;
      var currentBufferOffset = indexLength + 4;

      writeAtOffset(quad);

      return result;

      function writeAtOffset(quad) {
        var encodedName = encodeQuadNameToBinary(quad.name);

        result.writeInt32LE(encodedName, currentIndexOffset); currentIndexOffset += 4;
        result.writeInt32LE(currentBufferOffset, currentIndexOffset); currentIndexOffset += 4;

        quad.buffer.copy(result, currentBufferOffset); // store this quad into destination
        currentBufferOffset += quad.buffer.byteLength;

        for (var i = 0; i < 4; ++i) {
          if (quad[i]) writeAtOffset(quad[i]);
        }
      }
    }

    function getChildrenCount(quad) {
      var count = 1;
      for (var i = 0; i < 4; ++i) {
        if(quad[i]) count += getChildrenCount(quad[i]);
      }

      return count;
    }

    function collectTerminalLayersAndFlushLeaves(startFrom) {
      var i;
      var hasChildren = false;

      for (i = 0; i < 4; ++i) {
        if (startFrom[i]) {
          hasChildren = true;
          break;
        }
      }

      if (startFrom.buffer && !hasChildren) {
        // it's a leaf.
        saveQuad(startFrom);
        return;
      } else if (startFrom.buffer) {
        terminalLayers.push(startFrom);
        return;
      }

      for (i = 0; i < 4; ++i) {
        if (startFrom[i]) collectTerminalLayersAndFlushLeaves(startFrom[i]);
      }
    }
  }

  function makeQuadDir(name) {
    var dirName = path.join(quadFSDir, name);
    mkdirp.sync(dirName);

    return dirName
  }
}

function toBinaryEncodedName(quad) {
  return encodeQuadNameToBinary(quad.name);
}

var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var binaryDumpTreeUtils = require('../../lib/binaryDumpTree.js');
var encodeQuadNameToBinary = require('../../lib/binaryQuadName.js').encodeQuadNameToBinary;

module.exports = createQuadFS;

var saveThreshold = 32 * 1024;

function createQuadFS(quadFSDir) {
  var layers = new Map();
  var positionsLayer = createLayer('positions');

  var api = {
    createLayer: createLayer,
    saveTreeIndex: saveTreeIndex,
    positionsLayer: positionsLayer
  };

  return api;

  function saveTreeIndex(root) {
    var uint32Array = binaryDumpTreeUtils.binaryEncodeTree(root);
    // 4 int 32 for left/top/right/bottom
    // + binary tree itself
    // + terminal nodes index.
    var terminalNodes = positionsLayer.flush();
    var bufferSize = (4 + uint32Array.length + terminalNodes.length) * 4;

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

    for (i = 0; i < terminalNodes.length; ++i) {
      treeBuffer.writeUInt32LE(terminalNodes[i], offset);
      offset += 4;
    }
    fs.writeFileSync(path.join(quadFSDir, 'tree.bin'), treeBuffer);
  }

  function createLayer(name) {
    if (layers.has(name)) return layers.get(name);

    var layerDir = path.join(quadFSDir, name);

    var layerRoot = {
      selfByteLength: 0,
      childrenByteLength: 0
    };


    mkdirp.sync(layerDir);

    var layerAPI = {
      saveBinaryQuad: saveBinaryQuad,
      saveJSONQuad: saveJSONQuad,
      flush: flush
    };

    layers.set(name, layerAPI);

    return layerAPI;

    function flush() {
      var terminalLayers = [];

      collectTerminalLayersAndFlushLeaves(layerRoot);

      terminalLayers.forEach(storeTerminalQuad);
      // TODO: Append terminal records to the tree index.

      return terminalLayers.map(toBinaryEncodedName);

      function storeTerminalQuad(quad) {
        var subtreeBuffer = serializeBuffersSubtree(quad);
        quad.buffer = subtreeBuffer;
        dumpBinaryQuad(quad);
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
        var result = new Buffer(4 + indexLength + quad.childrenByteLength + quad.selfByteLength)

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
          dumpBinaryQuad(startFrom);
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

    function saveBinaryQuad(quadName, buffer) {
      var quad = getQuad(quadName, buffer);
      dumpBinaryQuadIfNeeded(quad);
    }

    function getQuad(quadName, buffer) {
      var quad = layerRoot;
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
        dumpBinaryQuadIfNeeded(child)
      }

      quad.selfByteLength = byteLength;
      quad.name = quadName;
      quad.buffer = buffer;

      return quad;
    }

    function dumpBinaryQuadIfNeeded(quad) {
      var buffer = quad.buffer;
      if (!buffer) return;

      if (buffer.byteLength >= saveThreshold || quad.childrenByteLength >= saveThreshold) {
        dumpBinaryQuad(quad);
      }
    }

    function dumpBinaryQuad(quad) {
      var fullFileName = path.join(layerDir, quad.name + '.bin');
      console.log('saving ' + fullFileName);
      fs.writeFileSync(fullFileName, quad.buffer);

      quad.buffer = null; // release memory
    }

    function saveJSONQuad(quadName, object) {
      var fullFileName = path.join(layerDir, quadName + '.json');
      fs.writeFileSync(fullFileName, JSON.stringify(object), 'utf8');
    }
  }
}

function toBinaryEncodedName(quad) {
  return encodeQuadNameToBinary(quad.name);
}

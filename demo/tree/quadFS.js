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
        // we use 4 bytes per children to store their children, just to keep
        // binary data aligned with int32:
        var result = new Buffer(childrenCount * 4 + quad.childrenByteLength + quad.selfByteLength)
        writeAtOffset(quad, 0);
        return result;

        function writeAtOffset(quad, offset) {
          var childrenRecord = 0;
          var i;
          for (i = 0; i < 4; ++i) {
            if (quad[i]) childrenRecord |= (1 << i)
          }

          result.writeInt32LE(childrenRecord, offset);
          quad.buffer.copy(result, offset + 4); // store this quad into destination

          offset += quad.buffer.byteLength + 4;

          for (i = 0; i < 4; ++i) {
            if (quad[i]) offset = writeAtOffset(quad[i], offset);
          }

          return offset;
        }
      }

      function getChildrenCount(quad) {
        var count = 0;
        for (var i = 0; i < 4; ++i) {
          if(quad[i]) count += getChildrenCount(quad[i]);
        }

        return count + 1;
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

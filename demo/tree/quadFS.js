var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var binaryDumpTreeUtils = require('../../lib/binaryDumpTree.js');

module.exports = createQuadFS;

function createQuadFS(quadFSDir) {
  var api = {
    createLayer: createLayer,
    saveTreeIndex: saveTreeIndex
  };

  return api;


  function saveTreeIndex(root) {
    var uint32Array = binaryDumpTreeUtils.binaryEncodeTree(root);
    // 4 int 32 for left/top/right/bottom
    var bufferSize = (4 + uint32Array.length) * 4;
    var treeBuffer = Buffer.alloc(bufferSize);

    var offset = 0;
    treeBuffer.writeInt32LE(root.rect.left, offset); offset += 4;
    treeBuffer.writeInt32LE(root.rect.top, offset); offset += 4;
    treeBuffer.writeInt32LE(root.rect.right, offset); offset += 4;
    treeBuffer.writeInt32LE(root.rect.bottom, offset); offset += 4;

    for (var i = 0; i < uint32Array.length; ++i) {
      treeBuffer.writeUInt32LE(uint32Array[i], offset);
      offset += 4;
    }

    fs.writeFileSync(path.join(quadFSDir, 'tree.bin'), treeBuffer);
  }


  function createLayer(name) {
    var layerDir = path.join(quadFSDir, name);
    mkdirp.sync(layerDir);

    var layerAPI = {
      saveBinaryQuad: saveBinaryQuad,
      saveJSONQuad: saveJSONQuad
    };

    return layerAPI;

    function saveBinaryQuad(quadName, buffer) {
      var fullFileName = path.join(layerDir, quadName + '.bin');
      console.log('saving ' + fullFileName);
      fs.writeFileSync(fullFileName, buffer);
    }

    function saveJSONQuad(quadName, object) {
      var fullFileName = path.join(layerDir, quadName + '.json');
      fs.writeFileSync(fullFileName, JSON.stringify(object), 'utf8');
    }
  }
}



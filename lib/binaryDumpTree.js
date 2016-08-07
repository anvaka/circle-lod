module.exports = {
  binaryEncodeTree: binaryEncodeTree,
  binaryDecodeTree: binaryDecodeTree,
  createBinaryStream: createBinaryStream,
  compareTree: compareTree
};

function binaryEncodeTree(tree) {
  var binaryStream = createBinaryStream(60 * 1024);
  var bitOffset = 0

  writeNode(bitOffset, tree)

  return binaryStream.getBuffer();

  function writeNode(bitOffset, node) {
    for (var i = 0; i < 4; ++i) {
      if (node.children && node.children[i]) {
        binaryStream.set(bitOffset + i, 1)
      } else {
        binaryStream.set(bitOffset + i, 0)
      }
    }

    bitOffset += 4;

    for (var i = 0; i < 4; ++i) {
      if (node.children && node.children[i]) {
        bitOffset = writeNode(bitOffset, node.children[i]);
      }
    }

    return bitOffset;
  }
}

function binaryDecodeTree(uint32Buffer) {
  var typeValid = uint32Buffer instanceof Uint32Array;

  if (!typeValid) throw new Error('Invalid buffer type');

  var binaryStream = createBinaryStream(uint32Buffer);

  if (binaryStream.length === 0) return;
  var root = {};

  readNode(0, root);

  return root;

  function readNode(bitOffset, node) {
    for (var i = 0; i < 4; ++i) {
      if (binaryStream.get(bitOffset + i)) {
        setChild(node, i);
      }
    }

    bitOffset += 4;

    if (!node.children) return bitOffset;

    for (var i = 0; i < 4; ++i) {
      if (node.children[i]) {
        bitOffset = readNode(bitOffset, node.children[i]);
      }
    }

    return bitOffset;
  }

  function setChild(node, childIndex) {
    if (!node.children) node.children = {};
    node.children[childIndex] = {};
  }
}

function createBinaryStream(allocateCellsOrBuffer) {
  var buffer;
  var initialLength = 0;

  if (allocateCellsOrBuffer instanceof Uint32Array) {
    buffer = allocateCellsOrBuffer;
    initialLength = buffer.length * 32;
  } else if (typeof allocateCellsOrBuffer === 'number') {
    buffer = new Uint32Array(allocateCellsOrBuffer);
  } else {
    throw new Error('Should be either number or Uint32Array');
  }

  var api = {
    get: get,
    set: set,
    getBuffer: getBuffer,
    length: initialLength
  };

  return api;

  function getBuffer() {
    var size = Math.ceil(api.length / 32);
    return buffer.subarray(0, size);
  }

  function get(bitOffset) {
    if (bitOffset > api.length) throw new Error('Index out of range');

    var cellAddress = Math.floor(bitOffset / 32);
    var cell = buffer[cellAddress];

    var cellOffset = bitOffset % 32;
    return (cell >> cellOffset) & 1;
  }

  function set(bitOffset, isSet) {
    if (bitOffset > api.length) {
      api.length = bitOffset;
    }

    var cellAddress = Math.floor(bitOffset / 32);

    while (cellAddress >= buffer.length) {
      // allocate new buffer.
      var newBuffer = new Uint32Array(buffer.length * 2);
      newBuffer.set(buffer);
      buffer = newBuffer;
    }

    var cellOffset = bitOffset % 32;
    var cell = buffer[cellAddress];
    var mask = (1 << cellOffset);
    if (isSet) {
      cell |= mask
    } else {
      cell &= ~mask;
    }
    buffer[cellAddress] = cell;
  }
}

function compareTree(a, b) {
  if (a && !b) return false;
  if (b && !a) return false;

  if (!a && !b) return true;

  if (a.children && b.children) {
    for (var i = 0; i < 4; ++i) {
      // if any children does not match - the entire tree does not match
      if (!compareTree(a.children[i], b.children[i])) return false;
    }
    return true;
  }

  // trees only match if they don't have children at this point
  return !a.children && !b.children;
}

//
// var a = { children: {0: {}, 1: {}, 2: {}, 3: {children: {0: {}}}} };
// var b = binaryDecodeTree(binaryEncodeTree(a));
//
// console.log(compareTree(a, b));

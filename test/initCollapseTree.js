var initCollapseTree = require('../lib/initCollapseTree.js');
var fs = require('fs');
var path = require('path');

var fname = process.argv[2] || path.join(__dirname, '..', 'demo', 'positions-s.yt.2d.bin');
var buffer = toArrayBuffer(fs.readFileSync(fname));
var positions = new Int32Array(buffer);

initCollapseTree(positions)

function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}

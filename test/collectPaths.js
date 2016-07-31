var test = require('tap').test;
var collectPaths = require('../lib/collectPaths.js');

test('it can find paths', function(t) {
  var tree = createTree();
  var paths = collectPaths({
    left: 1,
    top: 1,
    right: 51,
    bottom: 51
  }, tree);

  t.ok(paths.has('031'), 'it finds path');
  t.end();
});

function createTree() {
  return {
    children: {
      0: {},
      1: {},
      2: {},
      3: {
        children: {
          1: {},
        }
      }
    },
    rect:{left:-100,top:-100,right:100,bottom:100}
  }
}

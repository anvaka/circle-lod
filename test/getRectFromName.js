var test = require('tap').test;
var getRectFromName = require('../lib/getRectFromName.js');

test('it can find paths', function(t) {
  var rect = getRectFromName('000', {
    left: 0,
    top: 0,
    bottom: 100,
    right: 100
  });

  t.ok(rect.left === 0 &&
       rect.top === 0 &&
       rect.bottom === 25 &&
       rect.right === 25)
  t.end();
});

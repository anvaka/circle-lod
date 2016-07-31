var rectAContainsB = require('./rectAContainsB.js');
var rectAIntersectsB = require('./rectAIntersectsB.js');

module.exports = collectPaths;

function collectPaths(cameraRect,  tree) {
  var minLength = Number.POSITIVE_INFINITY;
  var paths = new Set();
  var quadRect = tree.rect;

  var queue = [{
    left: quadRect.left,
    top: quadRect.top,
    bottom: quadRect.bottom,
    right: quadRect.right,
    path: '0',
    root: tree
  }];

  traverse(quadRect);

  return paths;

  function traverse(quad) {
    while(queue.length) {
      var quad = queue.shift();
      if (quad.path.length ===  minLength + 1) {
        if (rectAIntersectsB(cameraRect, quad)) {
          paths.add(quad.path);
        }
        continue;
      } else if (quad.path.length > minLength) continue;

      if (rectAContainsB(cameraRect, quad)) {
        // that's it. We found our candidates:
        if (quad.path.length > 1) {
          paths.add(quad.path);
          if (minLength > quad.path.length) minLength = quad.path.length;
        } else {
          paths.add('0');
          return;
        }
      } else if(rectAIntersectsB(cameraRect, quad)) {
        // This is only partial intersection. Schedule visit to these quads
        var children = quad.root.children;
        if (children) {
          if (children[0]) {
            var upLeft = {
              left: quad.left,
              right: (quad.left + quad.right)/2,
              top: quad.top,
              bottom: (quad.top + quad.bottom)/2,
              path: quad.path + '0',
              root: children[0]
            };
            queue.push(upLeft);
          }
          if (children[1]) {
            var upRight = {
              left: (quad.left + quad.right)/2,
              right: quad.right,
              top: quad.top,
              bottom: (quad.top + quad.bottom)/2,
              path: quad.path + '1',
              root: children[1]
            };
            queue.push(upRight);
          }
          if (children[2]) {
            var downLeft = {
              left: quad.left,
              right: (quad.left + quad.right)/2,
              top: (quad.top + quad.bottom)/2,
              bottom: quad.bottom,
              path: quad.path + '2',
              root: children[2]
            };
            queue.push(downLeft);
          }
          if (children[3]) {
            var downRight = {
              left: (quad.left + quad.right)/2,
              right: quad.right,
              top: (quad.top + quad.bottom)/2,
              bottom: quad.bottom,
              path: quad.path + '3',
              root: children[3]
            }
            queue.push(downRight);
          }
        } else {
          // we intersect the rect, but there are no children - add entire quad:
          paths.add(quad.path);
        }
      }
    }
  }
}

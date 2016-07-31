var rectAIntersectsB = require('./rectAIntersectsB.js');

module.exports = collectPaths;

function collectPaths(cameraRect,  tree) {
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
  var dx = quadRect.right - quadRect.left;
  var camDx = Math.max(cameraRect.right - cameraRect.left, cameraRect.bottom - cameraRect.top);

  var level = dx < camDx ? 2 : 3;
  while(dx/2 > camDx) {
    level += 1;
    dx = dx/2;
  }

  traverse(quadRect, level);

  return paths;

  function traverse(quad, depth) {
    while(queue.length) {
      var quad = queue.shift();
      var currentDepth = quad.path.length;
      if (currentDepth > depth) continue;
      if (!rectAIntersectsB(cameraRect, quad)) continue;

      if (currentDepth === depth) {
        // We found a candidate:
        paths.add(quad.path);
        continue;
      }

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
          if(rectAIntersectsB(upLeft, cameraRect)) queue.push(upLeft);
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

          if (rectAIntersectsB(upRight, cameraRect)) queue.push(upRight);
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
          if (rectAIntersectsB(downLeft, cameraRect)) queue.push(downLeft);
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
          if (rectAIntersectsB(downRight, cameraRect)) queue.push(downRight);
        }
      } else {
        // we intersect the rect, but there are no children - add entire quad:
        paths.add(quad.path);
      }
    }
  }
}

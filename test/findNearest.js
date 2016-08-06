var quadtree = require('d3-quadtree').quadtree;
var points = [];
for (var i = 0; i < 10; ++i) {
  points.push({
    x: i,
    y: 0
  });
}

var tree = quadtree(points, n => n.x, n => n.y);

var p = findNearest(tree, {x: 0, y: 0}, 3)
console.log(p);

function findNearest(tree, target, radius) {
  var r2 = radius * radius;
  var found = [];

  tree.visit(function(node, left, top, right, bottom) {
    var shouldStop = !circleIntersectsRect(target.x, target.y, radius, left, top, right, bottom)
    appendIfNeeded(node);
    return shouldStop; // no need to go there.
  });

  return found;

  function appendIfNeeded(node) {
    if (!node.length) {
      var q = node;
      do {
        var dx = q.data.x - target.x;
        var dy = q.data.y - target.y;
        if (dx * dx + dy * dy < r2) {
          found.push(q.data);
        }
      } while (q = q.next);
    }
  }
}

function circleIntersectsRect(cx, cy, r, left, top, right, bottom) {
  var closestX = clamp(cx, left, right);
  var closestY = clamp(cy, top, bottom);

  // Calculate the distance between the circle's center and this closest point
  var distanceX = cx - closestX;
  var distanceY = cy - closestY;

  // If the distance is less than the circle's radius, an intersection occurs
  var distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
  return distanceSquared < (r * r);
}

function clamp(x, min, max) {
  if (x < min) return min;
  if (x > max) return max;

  return x;
}

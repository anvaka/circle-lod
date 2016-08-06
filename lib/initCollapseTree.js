// TODO: This is unoptimized prototype. It does not need as many quadtrees
// as it has right now.
var initTree = require('./initTree.js');
var initNodes = require('./initNodes.js');
var quadtree = require('d3-quadtree').quadtree;

module.exports = initRankTree;

var minQuadSize = 2048;

function initRankTree(positions) {
  var nodes = initNodes(positions);
  var tree = initTree(nodes);

  var quads = dumpQuads(tree);

  var levelsCount = getLevelsCount(tree._x1 - tree._x0);
  var levels = [{
    positions: nodes,
    tree: tree
  }];

  var total = nodes.length;
  for (var level = 1; level < levelsCount; ++level) {
    total /= 2;
    var levelNodes = getTopNodesFromQuads(quads, total).map(function(id) {
      return nodes[id];
    });

    levels[level] = {
      positions: levelNodes,
      tree: quadtree(levelNodes, x, y)
    }
  }

  return levels;

  function getTopNodesFromQuads(quads, nodeCount) {
    var resultSet = new Set();
    for (var i = 0; i < quads.length; ++i) {
      var id = quads[i].largest.data.i;
      if (id === undefined) throw new Error('Id is supposed to be defined');

      resultSet.add(id);
      if (resultSet.size > nodeCount - 1) {
        return Array.from(resultSet);
      }
    }

    return Array.from(resultSet);
  }

  function dumpQuads(tree) {
    var quads = [];
    tree.visit(function(q) {
      quads.push(q);
    });

    quads.sort(function(a, b) {
      return (b.count || 0) - (a.count || 0);
    });

    return quads;
  }
}

function initCollapseTree(positions) {
  var nodes = initNodes(positions);
  var tree = initTree(nodes);

  nodes.sort(function(x, y) {
    return y.deps - x.deps;
  })

  var levelsCount = getLevelsCount(tree._x1 - tree._x0);
  var levels = [{
    positions: nodes,
    tree: tree
  }];

  for (var level = 1; level < levelsCount; ++level) {
    var nodesInLevel = initLevel(level, levels[level - 1]);
    levels[level] = nodesInLevel;
  }

  return levels;
}

function initLevel(level, prevLevel) {
  var positions = prevLevel.positions;
  var pointsInLevel = [];

  positions.forEach(function(p) {
    if (p.merged) return;

    //var r = getTotalR(p);
    var searchRadius = minQuadSize * 0.05 * level;
    var nearest = findNearest(prevLevel.tree, p, searchRadius);
    var merged = mergePoints(p, nearest, level);
    if (pointVisibleAtLevel(merged, level)) {
      pointsInLevel.push(merged);
    }
  });

  pointsInLevel.sort(function(x, y) {
    return y.deps - x.deps;
  });

  return {
    positions: pointsInLevel,
    tree: quadtree(pointsInLevel, x, y)
  }
}

function pointVisibleAtLevel(point, level) {
  return point.deps / level >= 2;
}

function getTotalR(point) {
  return 5 *  Math.log(1 + point.count);
}

function mergePoints(target, points, level) {
  var finalPoint = Object.assign({}, target);
  finalPoint.count = 0;

  points.forEach(function(p) {
    p.merged = true;
    finalPoint.count += p.count || 1;
    finalPoint.deps += p.deps || 0;
    // todo: do I need to change final point?
  });

  return finalPoint;
}

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
          if (q.data.deps < target.deps) found.push(q.data);
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

function getLevelsCount(treeSize) {
  var levels = 0;

  while (treeSize > minQuadSize) {
    levels += 1;
    treeSize /= 2;
  }

  return levels;
}

function x(n) { return n.x; }
function y(n) { return n.y; }

// TODO: This is unoptimized prototype. It does not need as many quadtrees
// as it has right now.
var initTree = require('./initTree.js');
var initNodes = require('./initNodes.js');

module.exports = initRankTree;

var minQuadSize = 2048;

function initRankTree(positions) {
  var nodes = initNodes(positions);
  var tree = initTree(nodes);

  var quads = dumpQuads(tree);

  // TODO: This should really depend on distribution of node sizes, not on quad tree size
  var levelsCount = getLevelsCount(tree._x1 - tree._x0);
  var levels = [];

  var total = nodes.length;
  for (var level = 0; level < levelsCount; ++level) {
    levels[level] = getTopNodesFromQuads(quads, total);
    total /= 2;
  }

  var result = [];
  if (levelsCount > 0) {
    // Kind of a hack. If next level resembles more than 90% of the previous level
    // just merge them together:
    result.push(levels[0]);
    var prevLevel = result[0];
    for (var i = 1; i < levelsCount; ++i) {
      var ratio = levels[i].size/prevLevel.size;
      if (ratio <= 0.9) {
        prevLevel = levels[i];
        result.push(prevLevel);
      }
    }
  }

  return {
    levels: result,
    tree: tree
  }

  function getTopNodesFromQuads(quads, nodeCount) {
    // todo: this can be optimized a lot
    var resultSet = new Set();
    for (var i = 0; i < quads.length; ++i) {
      addQuad(i);

      if (resultSet.size > nodeCount - 1) {
        break;
      }
    }
    // so, we maxed out allowed quads number for this level.
    // Make sure we don't break the level abruptly:
    var lastQuad = quads[i];
    while (i < quads.length && quads[i].count === lastQuad.count) {
      addQuad(i);
      i++;
    }

    return resultSet;

    function addQuad(i) {
      // leaf nodes may not have "largest" field.
      var quadDataSource = quads[i].largest || quads[i];
      var id = quadDataSource.data.i;
      if (id === undefined) throw new Error('Id is supposed to be defined');

      resultSet.add(id);
    }
  }

  function dumpQuads(tree) {
    var quads = [];
    tree.visit(function(q) {
      if (q.length) {
        quads.push(q);
      } else {
        do {
          quads.push(q);
          // there is a chance that leaf had multiple quads.
        } while (q = q.next);
      }
    });

    quads.sort(function(a, b) {
      return (b.count || 0) - (a.count || 0);
    });

    return quads;
  }
}

function getLevelsCount(treeSize) {
  var levels = 0;

  while (treeSize > minQuadSize) {
    levels += 1;
    treeSize /= 2;
  }

  return levels;
}

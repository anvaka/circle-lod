module.exports = initTree;
// todo: should probably use yaot - d3-quadtree is not
// memory optimal for this problem.
var quadtree = require('d3-quadtree').quadtree;

function initTree(positions) {
    var nodes = [];

    for (var i = 0; i < positions.length; i += 3) {
      nodes.push({
        x: positions[i],
        y: positions[i + 1],
        deps: positions[i + 2],
        i: i / 3,
        r: (15 * Math.log(1 + positions[i + 2]))
      });
    }

    var tree = quadtree(nodes, x, y);
    tree.visitAfter(accumulateRanks);

    return tree;
}

function x(n) { return n.x; }
function y(n) { return n.y; }

function accumulateRanks(quad, left, top, right, bottom) {
  var area = 0, q, i;
  var largest;

  // TODO: This is a bad idea. Either don't use d3's quad tree or find another way.
  quad.left = left;
  quad.top = top;
  quad.right = right;
  quad.bottom = bottom;

  // For internal nodes, accumulate ranks from child quadrants.
  if (quad.length) {
    var maxR = -1;

    for (i = 0; i < 4; ++i) {
      if ((q = quad[i])) {
        area += q.area;
        if (q.largest.data.r > maxR) {
          maxR = q.largest.data.r;
          largest = q.largest;
        }
      }
    }
    quad.largest = largest;
    if (!largest) {
      debugger;
    }

    quad.x = largest.data.x;
    quad.y = largest.data.y;
  } else {
    q = quad;
    largest = quad;

    do {
      area += Math.PI * q.data.r * q.data.r;
      if (q.data.r > largest.data.r) {
        largest = q;
      }
    } while (q = q.next);

    quad.largest = largest;
    quad.x = largest.data.x;
    quad.y = largest.data.y;
  }

  quad.area = area;
}


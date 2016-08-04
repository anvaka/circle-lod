module.exports = initTree;
// todo: should probably use yaot - d3-quadtree is not
// memory optimal for this problem.
var quadtree = require('d3-quadtree').quadtree;

function initTree(nodes) {
  var tree = quadtree(nodes, x, y);
  tree.visitAfter(accumulateRanks);

  return tree;
}

function x(n) { return n.x; }
function y(n) { return n.y; }

function accumulateRanks(quad, left, top, right, bottom) {
  var area = 0, q, i;
  var largest;
  var count = 0;

  // TODO: This is a bad idea. Either don't use d3's quad tree or find another way.
  quad.left = left;
  quad.top = top;
  quad.right = right;
  quad.bottom = bottom;

  if (quad.length) {
    var maxR = -1;

    for (i = 0; i < 4; ++i) {
      q = quad[i];
      if (q) {
        area += q.area;
        count += q.count;
        if (q.largest.data.r > maxR) {
          maxR = q.largest.data.r;
          largest = q.largest;
        }
      }
    }

    quad.count = count;
    quad.largest = largest;

    if (!largest) {
      console.log('This is impossible!');
      throw new Error('no largest');
    }

    quad.x = largest.data.x;
    quad.y = largest.data.y;
  } else {
    q = quad;
    largest = quad;
    count = 0;

    do {
      area += Math.PI * q.data.r * q.data.r;
      if (q.data.r > largest.data.r) {
        largest = q;
      }
      count += 1;
    } while (q = q.next);

    quad.count = count;
    quad.largest = largest;
    quad.x = largest.data.x;
    quad.y = largest.data.y;
  }

  quad.area = area;
}


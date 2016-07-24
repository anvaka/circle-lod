var quadtree = require('d3-quadtree').quadtree;
var request = require('./lib/request.js');
var maxNodes = 4096;
var createProrityQueue = require('./lib/priorityQueue.js');
var createRenderer = require('./renderer.js');
var labels;

var fname = 'positions2d-size.bin';
request(fname, {
    responseType: 'arraybuffer',
})
.then(initTree)
.then(render);

request('labels.json', {
    responseType: 'json',
}).then(function(data) {
  labels = data;
});

function render(tree) {
  var renderer = createRenderer(document.body);

  renderer.on('positionChanged', renderOnce);
  document.body.addEventListener('mousemove', onMouseMove);

  renderOnce();

  function renderOnce() {
    var rect = renderer.getVisibleRect()
    var topQuads = getTopQuads(tree, rect);
//    var luminanceGrid = getLuminanceGrid(tree, rect, 24, 24);

    renderer.render(topQuads);
  }

  function onMouseMove(e) {
    var pos = renderer.getModelPosFromScreen(e.clientX, e.clientY);
    var dat = tree.find(pos.x, pos.y, 30)
    if (dat) {
      if (labels) {
        console.log(labels[dat.i] + ' - ' + dat.deps);
      } else {
        console.log(dat.deps)
      }
    }
  }
}

function getLuminanceGrid(tree, rect, cols, rows) {
  var dx = (rect.right - rect.left)/cols
  var dy = (rect.bottom - rect.top)/rows

  var grid = [];
  for (var j = 0; j < rows; ++j) {
    for (var i = 0; i < cols; ++i) {
      var left = (i - 0.5) * dx + rect.left
      var top = (j - 0.5) * dy + rect.top
      grid.push({
        x: i * dx + rect.left,
        y: j * dy + rect.top,
        luminance: getTotalLuminanceInRect(tree, left, top, dx, dy)
      });
    }
  }

  return {
    grid: grid,
    cols: cols,
    rows: rows
  };

  function getTotalLuminanceInRect(tree, left, top, width, height) {
    var sum = 0;
    tree.visit(function(q, x0, y0, x1, y1) {
      var right = left + width
      var bottom = top + height

      if (!intersectRect(
        left, top, right, bottom,
        x0, y0, x1, y1
      )) return true; // Don't visit, rects do not intersect

      if (rectInside(x0, y0, x1, y1, left, top, right, bottom)) {
        // the entire quad is inside our cell, so we add 
        if (q.data) {
          sum += q.data.deps + 1
        }

        return true; // no need to traverse down
      }
      // otherwise we should keep traversing
    })

    return sum;
  }
}

function rectInside(iLeft, iTop, iRight, iBottom,
                   oLeft, oTop, oRight, oBottom) {
  return oLeft <= iLeft &&
    oRight >= iRight &&
    oTop <= iTop &&
    oBottom >= iBottom;
}

function getTopQuads(tree, rect) {
  var quadsPriorityQueue = createProrityQueue(quadAreaComparator, maxNodes * 5);

  var root = tree.root();

  quadsPriorityQueue.push(root);

  var candidatesAdded = true;

  while ((quadsPriorityQueue.length < maxNodes) && candidatesAdded) {
    candidatesAdded = findAndAppendCandidates(quadsPriorityQueue);
  }

  // one more run gives smoother approximation
  findAndAppendCandidates(quadsPriorityQueue);

  return quadsPriorityQueue;

  function findAndAppendCandidates(queue) {
    var candidates = popNodesWithLargestArea(queue);
    if (!candidates || candidates.length === 0) {
      // if we have no more split candidates - we are done.
      return false;
    }

    appendCandidates(candidates, queue);

    return true;

    function appendCandidates(candidates) {
      candidates.forEach(appendCandidate);
    }

    function appendCandidate(splitCandidate) {
      for (var i = 0; i < 4; ++i) {
        var child = splitCandidate[i];
        if (intersects(child, rect)) {
          queue.push(child);
        }
      }
    }
  }
}

function intersectRect(aLeft, aTop, aRight, aBottom,
                      bLeft, bTop, bRight, bBottom) {
  return (aLeft <= bRight &&
          bLeft <= aRight &&
          aTop <=  bBottom &&
          bTop <=  aBottom)
}

function intersects(a, b) {
  if (!a || !b) return false;

  return (a.left <= b.right &&
          b.left <= a.right &&
          a.top <= b.bottom &&
          b.top <= a.bottom)
}

function popNodesWithLargestArea(queue) {
  var maxElement = queue.peek();
  if (!maxElement) return;
  // if the biggest node is a leaf - cannot pop anymore
  if (!maxElement.length) return;

  // now we are free to remove the biggest one.
  queue.pop();

  var result = [maxElement];
  var nextBest = queue.peek();

  while (nextBest && nextBest.length && nextBest.area === maxElement.area) {
    result.push(queue.pop());
    nextBest = queue.peek();
  }
  //
  return result;
}


function initTree(buffer) {
    var positions = new Int32Array(buffer);
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

function quadAreaComparator(a, b) {
  // make sure internal nodes are always larger than leafs.
  var isAInternal = ('length' in a);
  var isBInternal = ('length' in b);
  if (isBInternal && !isAInternal) {
    return false;
  } else if (isAInternal && !isBInternal) {
    return true;
  }

  return a.area > b.area;
}

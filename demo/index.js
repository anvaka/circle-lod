var quadtree = require('d3-quadtree').quadtree;
var request = require('./lib/request.js');
var maxNodes = 4096;
var createProrityQueue = require('./lib/priorityQueue.js');
var createRenderer = require('./renderer.js');

var fname = 'positions2d-size.bin';
request(fname, {
    responseType: 'arraybuffer',
})
.then(initTree)
.then(render);

function render(tree) {
  var renderer = createRenderer(document.body);
  renderer.on('positionChanged', renderOnce);

  renderOnce();

  function renderOnce() {
    var rect = renderer.getVisibleRect()
    var topQuads = getTopQuads(tree, rect);
    renderer.render(topQuads);
  }
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

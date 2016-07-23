var svg = require('simplesvg');
var panzoom = require('panzoom');
var quadtree = require('d3-quadtree').quadtree;
var request = require('./lib/request.js');
var maxNodes = 4096;
var scene = document.getElementById('scene');
var _ = require('lodash');
var createProrityQueue = require('./lib/priorityQueue.js');

var fname = 'positions2d-size.bin';
request(fname, {
    responseType: 'arraybuffer',
})
.then(initTree)
.then(render);

function getVisibleRect() {
  var svg = scene.ownerSVGElement;
  var buffer = 200;
  var topLeft = svg.createSVGPoint();
  topLeft.x = -buffer;
  topLeft.y = -buffer;

  var bottomRight = svg.createSVGPoint();

  bottomRight.x = document.body.clientWidth + buffer;
  bottomRight.y = document.body.clientHeight + buffer;

  var inverse = scene.getScreenCTM().inverse();
  bottomRight = bottomRight.matrixTransform(inverse);

  topLeft = topLeft.matrixTransform(inverse);

  return {
    top: topLeft.y,
    left: topLeft.x,
    bottom: bottomRight.y,
    right: bottomRight.x
  };
}


function render(tree) {
  var zoomer = panzoom(scene, {
    speed: 0.01,
    beforeWheel: _.throttle(renderOnce, 1000)
  });
  var width = document.body.clientWidth;
  var height = document.body.clientHeight;
  zoomer.moveBy(width / 2, height / 2);

  renderOnce();

  document.body.addEventListener('panend', function() { renderOnce(); }, true);

  function renderOnce() {
    var rect = getVisibleRect()
    console.time('best search')
    var topQuads = getTopQuads(tree, rect);
    console.timeEnd('best search')
    rerender(topQuads);
  }
}

function rerender(topQuads) {
  clearScene();
  topQuads.forEach(renderPoint);

  function renderPoint(quad) {
    var r = Math.sqrt(quad.area / Math.PI);
    r = Math.max(5, r);

    scene.appendChild(svg('circle', {
      cx: quad.x,
      cy: quad.y,
      r: r,
      stroke: 'white',
      fill: 'white',
      'stroke-width': 1,
    }));
  }
}

function clearScene() {
  while (scene.firstChild) {
      scene.removeChild(scene.firstChild);
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
        r: (5 * Math.log(1 + positions[i + 2]))
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

  // TODO: This is a bad idea. Either don't use d3's quad tree or find another way.
  quad.left = left;
  quad.top = top;
  quad.right = right;
  quad.bottom = bottom;

  // For internal nodes, accumulate ranks from child quadrants.
  if (quad.length) {
    var maxR = -1;
    var largest;

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

    quad.x = largest.data.x;
    quad.y = largest.data.y;
  } else {
    q = quad;
    var largest = quad;

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
  if (b.length && !a.length) {
    return false;
  } else if (a.length && !b.length) {
    return true;
  }

  return a.area > b.area;
}

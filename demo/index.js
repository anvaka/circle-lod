var svg = require('simplesvg');
var panzoom = require('panzoom');
var quadtree = require('d3-quadtree').quadtree;
var request = require('./lib/request.js');
var maxNodes = 4096;
var scene = document.getElementById('scene');
var _ = require('lodash');
var createProrityQueue = require('./lib/priorityQueue.js');

var fname = 'positions2d.bin';
request(fname, {
    responseType: 'arraybuffer',
})
.then(initTree)
.then(render);

function getVisibleRect() {
  var svg = scene.ownerSVGElement;
  var topLeft = svg.createSVGPoint();
  var bottomRight = svg.createSVGPoint();
  bottomRight.x = document.body.clientWidth;
  bottomRight.y = document.body.clientHeight;
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
  var zoomer = panzoom(scene);
  var width = document.body.clientWidth;
  var height = document.body.clientHeight;
  zoomer.moveBy(width / 2, height / 2);

  var zoomer = panzoom(scene);
  zoomer.moveBy(width / 2, height / 2);

  renderOnce();

  document.body.addEventListener('panend', function() { renderOnce(); }, true);
  document.body.addEventListener('zoomend', _.debounce(renderOnce, 100), true);
 

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
      stroke: 'black',
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
  var quadsPriorityQueue = createProrityQueue(quadAreaComparator);

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

    for (var i = 0; i < positions.length; i += 2) {
      nodes.push({
        x: positions[i],
        y: positions[i + 1],
        r: 5 // rank
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
    quad.largest = createProrityQueue(quadRadiusComparator, 5);

    for (i = 0; i < 4; ++i) {
      if ((q = quad[i])) {
        area += q.area;
        quad.largest.merge(q.largest);
      }
    }
    var largest = quad.largest.peek();

    quad.x = largest.x;
    quad.y = largest.y;
  } else {
    q = quad;
    q.largest = createProrityQueue(quadRadiusComparator, 5);

    do {
      area += Math.PI * q.data.r * q.data.r;
      quad.largest.push(q);
    } while (q = q.next);

    var largest = quad.largest.peek();
    quad.x = largest.data.x;
    quad.y = largest.data.y;
  }

  quad.area = area;
}

function quadRadiusComparator(a, b) {
  return a.data.r > b.data.r;
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

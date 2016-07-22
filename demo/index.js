var svg = require('simplesvg');
var panzoom = require('panzoom');
var quadtree = require('d3-quadtree').quadtree;
var request = require('./lib/request.js');
var maxNodes = 4096;
var scene = document.getElementById('scene');
var _ = require('lodash');

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
    var points = getTop(tree, rect);
    rerender(points);
  }
}

function rerender(points) {
  clearScene();
  points.forEach(renderPoint);

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

function getTop(tree, rect) {
  var points = []; // todo: this can be changed to prioritized array
  var root = tree.root();
  root.level = 0;

  points.push(root);
  var candidatesAdded = true;

  while ((points.length < maxNodes) && candidatesAdded) {
    candidatesAdded = findAndAppendCandidates(points);
  }

  // one more run gives smoother approximation
  findAndAppendCandidates(points);

  return points;

  function findAndAppendCandidates(queue) {
    var candidates = popNodesWithHighestValue(queue);
    if (!candidates || candidates.length === 0) {
      // if we have no more split candidates - we are done.
      return false;
    }

    appendCandidates(candidates, queue);

    return true;
  }

  function appendCandidates(candidates, queue) {
    candidates.forEach(function(splitCandidate) {
      for (var i = 0; i < 4; ++i) {
        var child = splitCandidate[i];
        if (intersects(child, rect)) {
          // todo: this should be priority queue
          queue.push(child);
        }
      }
    });
  }
}

function intersects(a, b) {
  if (!a || !b) return false;

  return (a.left <= b.right &&
          b.left <= a.right &&
          a.top <= b.bottom &&
          b.top <= a.bottom)
}

function popNodesWithHighestValue(array) {
  var max = Number.NEGATIVE_INFINITY;

  for (var i = 0; i < array.length; ++i) {
    var node = array[i];
    if (!node.length) {
      // we only consider internal nodes and ignore leafs.
      continue;
    }

    if (node.area > max) {
      max = node.area;
    }
  }

  if (max === Number.NEGATIVE_INFINITY) return; // no more nodes here.

  var firstIdx = 0;
  for (var i = 0; i < array.length; ++i) {
    var node = array[i];
    if (node.area === max) {
      var first = array[firstIdx];
      var node = array[i];
      array[i] = first;
      array[firstIdx] = node;
      firstIdx += 1;
    }
  }

  return array.splice(0, firstIdx);
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
  var area = 0, q, c, x, y, i;

  // TODO: This is bad idea. Either don't use d3's quad tree or find another way.
  quad.left = left;
  quad.top = top;
  quad.right = right;
  quad.bottom = bottom;

  // For internal nodes, accumulate ranks from child quadrants.
  if (quad.length) {
    for (x = y = i = 0; i < 4; ++i) {
      if ((q = quad[i]) && (c = q.area)) {
        area += c, x += c * q.x, y += c * q.y;
      }
    }
    quad.x = x / area;
    quad.y = y / area;
  } else {
    // For leaf nodes, accumulate ranks from coincident quadrants.
    q = quad;
    q.x = q.data.x;
    q.y = q.data.y;
    do area += Math.PI * q.data.r * q.data.r;
    while (q = q.next);
  }

  quad.area = area;
}

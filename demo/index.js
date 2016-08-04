var libInitTree = require('../lib/initTree.js');
var initNodes = require('../lib/initNodes.js');

var maxNodes = 4096 * 4;

var getTopQuads = require('../lib/getTopQuads.js');
var request = require('./lib/request.js');
var _ = require('lodash');
var createRenderer = require('./renderer.js');
var labels;
var groups;

//var fname = 'positions2d-size.bin';
var fname = 'positions.yt.2d.bin';
request('groups.yt.bin', {
  responseType: 'arraybuffer',
}).then(function(g) {
  groups = new Int16Array(g);

  return request(fname, {
      responseType: 'arraybuffer',
  })
})
.then(initTree)
.then(render);

request('labels.yt.json', {
    responseType: 'json',
}).then(function(data) {
  labels = data;
});

function render(tree) {
  var renderer = createRenderer(document.body, groups);

  renderer.on('positionChanged', _.throttle(renderOnce, 100));
  document.body.addEventListener('mousemove', onMouseMove);

  renderOnce();

  function renderOnce() {
    var rect = renderer.getVisibleRect()
    var topQuads = getTopQuads(tree, rect, maxNodes);
//    var luminanceGrid = getLuminanceGrid(tree, rect, 24, 24);

    renderer.render(topQuads);
  }

  function onMouseMove(e) {
    var pos = renderer.getModelPosFromScreen(e.clientX, e.clientY);
    var dat = tree.find(pos.x, pos.y, 30)
    if (dat) {
      if (labels) {
        console.log('https://youtube.com/channel/' + labels[dat.i] + ' - ' + dat.deps);
      } else {
        console.log(dat.deps)
      }
    }
  }

  function getVisibleQuads(rect) {
    tree.visit(function(node, left, top, right, bottom) {
    })
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


function intersectRect(aLeft, aTop, aRight, aBottom,
                      bLeft, bTop, bRight, bBottom) {
  return (aLeft <= bRight &&
          bLeft <= aRight &&
          aTop <=  bBottom &&
          bTop <=  aBottom)
}

function initTree(buffer) {
  var positions = new Int32Array(buffer);
  var nodes = initNodes(positions);
  return libInitTree(nodes);
}


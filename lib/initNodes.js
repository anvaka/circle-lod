module.exports = initNodes;

function initNodes(positions) {
  var nodes = [];
  var recordsPerNode = 4;

  for (var i = 0; i < positions.length; i += recordsPerNode) {
    nodes.push({
      x: positions[i],
      y: positions[i + 1],
      // TODO: rename to size.
      deps: positions[i + 2],
      i: i / recordsPerNode,
      r: (15 * Math.log(1 + positions[i + 2]))
    });
  }

  return nodes;
}

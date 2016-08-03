var createProrityQueue = require('./priorityQueue.js');
var reactAIntersectsB = require('./rectAIntersectsB.js');

module.exports = getTopQuads;

function getTopQuads(tree, rect, maxNodes) {
  var quadsPriorityQueue = createProrityQueue(quadAreaComparator, maxNodes * 5);

  var root = tree.root();

  quadsPriorityQueue.push(root);

  var candidatesAdded = true;

  while ((quadsPriorityQueue.length < maxNodes) && candidatesAdded) {
    candidatesAdded = findAndAppendCandidates(quadsPriorityQueue);
  }

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
        if (reactAIntersectsB(child, rect)) {
          queue.push(child);
        }
      }
    }
  }
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

function quadAreaComparator(a, b) {
  return a.count > b.count;
}

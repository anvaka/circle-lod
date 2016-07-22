module.exports = createProrityQueue;

// This is based on https://github.com/lemire/FastPriorityQueue.js (licensed
// under Apace 2.0, by https://github.com/lemire).
//
// I adjusted pop/push operations for my needs: Support hard limit on queue size
function createProrityQueue(compareCallback, maxElements) {
  var queue = [];
  var size = 0;
  var api = {
    push: push,
    forEach: forEach,
    merge: merge,
    peek: peek,
    pop: pop,
    length: size
  };

  maxElements = maxElements || Number.POSITIVE_INFINITY;

  return api;

  function peek() {
    if (size === 0) return;

    return queue[0];
  }

  function pop() {
    if (size === 0) return; // TODO: should this throw?

    var candidate = queue[0];
    size -= 1;
    api.length = size;

    if (size > 0) {
      queue[0] = queue[size]
      bubbleDown(0);
    }

    return candidate;
  }

  function bubbleDown(i) {
    var halfSize = size >>> 1;
    var element = queue[i];

    while (i < halfSize) {
      var left = (i << 1) + 1;
      var right = left + 1;
      var bestCandidate = queue[left];
      if (right < size) {
        if (compareCallback(queue[right], bestCandidate)) {
          left = right;
          bestCandidate = queue[right];
        }
      }
      if (!compareCallback(bestCandidate, element)) break;

      queue[i] = bestCandidate;
      i = left;
    }

    queue[i] = element;
  }

  function push(element) {
    var i = size;
    queue[size++] = element;

    while (i > 0) {
      var insertIndex = (i - 1) >> 1;
      var otherElement = queue[insertIndex];

      if(!compareCallback(element, otherElement)) break;

      queue[i] = otherElement;
      i = insertIndex;
    }

    queue[i] = element;

    if (size >= maxElements) {
      // NOTE: This can be optimized.
      size = maxElements;
      queue.length = size;
    }

    api.length = size;
  }

  function merge(otherQueue) {
    otherQueue.forEach(push);
  }

  function forEach(callback) {
    for (var i = 0; i < size; ++i) {
      callback(queue[i], i, queue);
    }
  }
}

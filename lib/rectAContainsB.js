module.exports = reactAContainsB;

function reactAContainsB(a, b) {
  if (!a || !b) return false;

  return a.left <= b.left &&
    a.right >= b.right &&
    a.top <= b.top &&
    a.bottom >= b.bottom;
}


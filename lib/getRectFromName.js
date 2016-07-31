module.exports = getRectFromName;

function getRectFromName(name, topRect) {
  var rect = {
    left: topRect.left,
    right: topRect.right,
    bottom: topRect.bottom,
    top: topRect.top,
  };

  if (name === '0') {
    return rect;
  }

  for (var i = 1; i < name.length; ++i) {
    switch (name[i]) {
      case '0':
        rect.right = (rect.left + rect.right)/2;
        rect.bottom = (rect.top + rect.bottom)/2;
        break;
      case '1':
        rect.left = (rect.left + rect.right)/2;
        rect.bottom = (rect.top + rect.bottom)/2;
        break;
      case '2':
        rect.right = (rect.left + rect.right)/2;
        rect.top = (rect.top + rect.bottom)/2;
        break;
      case '3':
        rect.top = (rect.top + rect.bottom)/2;
        rect.left = (rect.left + rect.right)/2;
        break
      default:
        throw new Error('invalid name ' + name);
    }
  }

  return rect;
}

var wheel = require('wheel')
var eventify = require('ngraph.events');

module.exports = panzoom;

function panzoom(camera, owner) {
  var isDragging = false
  var mousePos = {
    x: 0,
    y: 0
  }

  wheel.addWheelListener(owner, onMouseWheel)

  var api = eventify({
    dispose: dispose,
    speed: 0.03
  })

  owner.addEventListener('mousedown', handleMouseDown)

  return api;

  function handleMouseDown(e) {
    isDragging = true
    setMousePos(e);

    window.addEventListener('mouseup', handleMouseUp, true)
    window.addEventListener('mousemove', handleMouseMove, true)
  }

  function handleMouseUp() {
    disposeWindowEvents()
    isDragging = false
  }


  function setMousePos(e) {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
  }

  function handleMouseMove(e) {
    if (!isDragging) return;

    var dx = e.clientX - mousePos.x;
    var dy = e.clientY - mousePos.y;

    panByOffset(dx, dy);

    setMousePos(e);
  }

  function disposeWindowEvents() {
    window.removeEventListener('mouseup', handleMouseUp, true)
    window.removeEventListener('mousemove', handleMouseMove, true)
  }

  function dispose() {
    wheel.removeWheelListener(owner, onMouseWheel)
  }

  function panByOffset(dx, dy) {
    var currentScale = getCurrentScale();

    camera.position.x -= dx/currentScale
    camera.position.y += dy/currentScale

    api.fire('change');
  }

  function onMouseWheel(e) {
    var scaleMultiplier = getScaleMultiplier(e.deltaY)

    zoomTo(e.clientX, e.clientY, scaleMultiplier)
  }

  function zoomTo(clientX, clientY, scaleMultiplier) {
    var currentScale = getCurrentScale();

    var dx = (clientX - owner.clientWidth / 2) / currentScale;
    var dy = (clientY - owner.clientHeight / 2) / currentScale;

    camera.position.z *= scaleMultiplier;
    camera.position.x -= (scaleMultiplier - 1) * dx;
    camera.position.y += (scaleMultiplier - 1) * dy;

    api.fire('change');
  }

  function getCurrentScale() {
    var vFOV = camera.fov * Math.PI / 180
    var height = 2 * Math.tan( vFOV / 2 ) * camera.position.z
    var currentScale = owner.clientHeight / height

    return currentScale
  }

  function getScaleMultiplier(delta) {
    var scaleMultiplier = 1
    if (delta < 0) { // zoom out
      scaleMultiplier = (1 - api.speed)
    } else if (delta > 0) { // zoom in
      scaleMultiplier = (1 + api.speed)
    }

    return scaleMultiplier
  }
}

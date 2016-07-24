var THREE = require('three');
var defaultTexture = require('./defaultTexture.js');
var threePanZoom = require('./lib/three.panzoom.js');
var eventify = require('ngraph.events');

module.exports = createRenderer;

function createRenderer(container) {
  var positions, sizes, uniforms;
  var particleSystem;

  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1500000);

  camera.position.z = 1000;
  var scene = new THREE.Scene();
  scene.add(camera);
  var controls = threePanZoom(camera, container, THREE);
  var visibleRect = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };

  var renderer = makeThreeRenderer();

  var shaderMaterial = createParticleMaterial();

  var api = eventify({
    render: render,
    getVisibleRect: getVisibleRect,
    dispose: dispose
  });

  controls.on('change', function() {
    updateVisibleRect();
    api.fire('positionChanged', visibleRect)
  });

  updateVisibleRect();
  window.addEventListener('resize', onWindowResize, false);

  var lastFrame = requestAnimationFrame(frame);

  return api;

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();


    uniforms.scale.value = window.innerHeight * 0.5;

    renderer.setSize( window.innerWidth, window.innerHeight );

    updateVisibleRect();
    api.fire('positionChanged', visibleRect)
  }

  function updateVisibleRect() {
    var vFOV = camera.fov * Math.PI / 180;        // convert vertical fov to radians
    var height = 2 * Math.tan( vFOV / 2 ) * camera.position.z; // visible height

    var aspect = window.innerWidth / window.innerHeight;
    var width = height * aspect;                  // visible width
    var center = camera.position;

    visibleRect.left = center.x - width/2;
    visibleRect.right = center.x + width/2;
    visibleRect.top = center.y - height/2;
    visibleRect.bottom = center.y + height/2;
  }

  function dispose() {
    cancelAnimationFrame(lastFrame);
    controls.dispose();
  }

  function frame(/* time */) {
    lastFrame = requestAnimationFrame(frame);
    renderer.render(scene, camera);
  }

  function getVisibleRect() {
    return visibleRect
  }

  function render(points) {
    var geometry = new THREE.BufferGeometry();
    var pointsCount = points.length;

    positions = new Float32Array(pointsCount * 3);
    sizes = new Float32Array(pointsCount);

    points.forEach(function(p, i) {
      var idx = i * 3;
      positions[idx] = p.x;
      positions[idx + 1] = p.y;
      positions[idx + 2] = 0;

      var r = Math.sqrt(p.area / Math.PI);
      r = Math.max(5, r);
      sizes[i] = r;
    })

    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.addAttribute('size', new THREE.BufferAttribute(sizes, 1));

    if (particleSystem) {
      scene.remove(particleSystem);
    }

    particleSystem = new THREE.Points(geometry, shaderMaterial);
    particleSystem.frustumCulled = false;

    scene.add(particleSystem);
  }


  function vertexShader() {
    return [
      'attribute float size;',
      'uniform float scale;',
      '',
      'void main() {',
      '  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );',
      '  gl_PointSize = size * ( scale / - mvPosition.z );',
      '  gl_Position = projectionMatrix * mvPosition;',
      '}'
    ].join('\n');
  }

  function fragmentShader() {
    return [
      'uniform sampler2D texture;',
      '',
      'void main() {',
      '  vec4 tColor = texture2D( texture, gl_PointCoord );',
      '  if (tColor.a < 0.5) discard;',
      '  gl_FragColor = vec4( 1. );',
      '}'
    ].join('\n');
  }

  function createParticleMaterial() {
    uniforms = {
      scale: { value: window.innerHeight * 0.5 },
      texture: {
        type: "t",
        value: THREE.ImageUtils.loadTexture(defaultTexture)
      }
    };

    var material =  new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader(),
      fragmentShader: fragmentShader(),
      transparent: true
    });

    return material;
  }

  function makeThreeRenderer() {
    var renderer = new THREE.WebGLRenderer({
      antialias: true
    });

    renderer.setClearColor(0x000000, 1);
    renderer.setSize(container.clientWidth, container.clientHeight);

    container.appendChild(renderer.domElement);

    return renderer;
  }
}

var THREE = require('three');
var defaultTexture = require('../defaultTexture.js');
var threePanZoom = require('three.map.control');
var eventify = require('ngraph.events');
var rectAIntersectsB = require('../../lib/rectAIntersectsB.js');
var rectAContainsB = require('../../lib/rectAContainsB.js');
var createQuadTree = require('d3-quadtree').quadtree;
var _ = require('lodash');

module.exports = createRenderer;

function createRenderer(container, getGroup) {
  var  uniforms;
  var objects = new Map();
  var tree;
  var lastHover;
  var updateQuadTreeDebounced = _.debounce(updateQuadTree, 300);

  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1500000);

  var scene = new THREE.Scene();
  scene.add(camera);

  var controls = threePanZoom(camera, container);
  controls.max = 1300000; // TODO: This should depend on rect
  camera.position.z = controls.max;

  var visibleRect = {
      left: 0,
      top: 0,
      bottom: 0,
      right: 0
    };

  var renderer = makeThreeRenderer();

  var shaderMaterial = createParticleMaterial();

  var api = eventify({
    append: append,
    getVisibleRect: getVisibleRect,
    getCurrentChunks: getCurrentChunks,
    getModelPosFromScreen: getModelPosFromScreen,
    dispose: dispose
  });

  controls.on('change', function() {
    updateVisibleRect();
    api.fire('positionChanged', visibleRect)
  });

  updateVisibleRect();
  window.addEventListener('resize', onWindowResize, false);
  container.addEventListener('mousemove', onMouseMove);

  var lastFrame = requestAnimationFrame(frame);

  return api;

  function onMouseMove(e) {
    if (!tree) return;

    var pos = getModelPosFromScreen(e.clientX, e.clientY);
    var dat = tree.find(pos.x, pos.y, 30);
    if (dat !== lastHover) {
      api.fire('hover', dat);
      lastHover = dat;
    }
  }

  function getCurrentChunks() {
    return objects;
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();


    uniforms.scale.value = window.innerHeight * 0.5;

    renderer.setSize( window.innerWidth, window.innerHeight );

    updateVisibleRect();
    api.fire('positionChanged', visibleRect)
  }

  function updateVisibleRect() {
    var vFOV = camera.fov * Math.PI / 180
    var height = 2 * Math.tan( vFOV / 2 ) * camera.position.z

    var aspect = window.innerWidth / window.innerHeight
    var width = height * aspect
    var center = camera.position

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

  function getModelPosFromScreen(clientX, clientY) {
    var width = visibleRect.right - visibleRect.left
    var currentScale = window.innerWidth/width

    var dx = (clientX - window.innerWidth / 2) / currentScale;
    var dy = (clientY - window.innerHeight / 2) / currentScale;

    return {
      x: camera.position.x + dx,
      y: camera.position.y - dy
    }
  }

  function append(name, chunk) {
    var remove = [];
    objects.forEach(function(oldChunk, name) {
      if (!rectAIntersectsB(visibleRect, oldChunk.rect) || // oldChunk is no longer visible
          rectAContainsB(oldChunk.rect, chunk) || // We've got higher-res chunk (zoom in)
          rectAContainsB(chunk, oldChunk.rect) // lower res chunk was added (zoom out)
         ) {
        remove.push(name);
        scene.remove(oldChunk.particleSystem);
        oldChunk.particleSystem.geometry.dispose();
      }
    });

    remove.forEach(function(name) {
      objects.delete(name);
    });

    if (!rectAIntersectsB(visibleRect, chunk)) {
      return;
    }

    if (objects.has(name)) {
      console.warn('Requested to render chunk, that is already rendered: ', name);
      return;
    }

    var points = chunk.points;

    var geometry = new THREE.BufferGeometry();
    var pointsCount = points.length;

    var positions = new Float32Array(pointsCount * 2);
    var sizes = new Float32Array(pointsCount);
    var colors = new Float32Array(pointsCount * 3);

    var theme = [0x3366cc, 0xdc3912, 0xff9900, 0x109618, 0x990099, 0x0099c6, 0xdd4477, 0x66aa00, 0xb82e2e, 0x316395, 0x994499, 0x22aa99, 0xaaaa11, 0x6633cc, 0xe67300, 0x8b0707, 0x651067, 0x329262, 0x5574a6, 0x3b3eac];

    points.forEach(function(p, i) {
      var idx = i * 2;
      positions[idx] = p.x;
      positions[idx + 1] = p.y;
      sizes[i] = p.r;

      var group = getGroup(p.id);
      var color = theme[group % theme.length];

      var colIdx = i * 3;
      colors[colIdx + 0] = ((color & 0xff0000) >> 16)/255; //color.r; //p.x/16000 + 0.5;
      colors[colIdx + 1] = ((color & 0x00ff00) >> 8)/255; //color.g; // p.y/16000 + 0.5;
      colors[colIdx + 2] = ((color & 0x0000ff) >> 0)/255; //0.5;
    })

    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 2));
    geometry.addAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

    var particleSystem = new THREE.Points(geometry, shaderMaterial);
    particleSystem.frustumCulled = false;
    objects.set(name, {
      particleSystem: particleSystem,
      rect: chunk
    });

    scene.add(particleSystem);
    updateQuadTreeDebounced();
  }

  function updateQuadTree() {
    var points = [];
    objects.forEach(function(object) {
      object.rect.points.forEach(function(point) {
        points.push(point);
      });
    })

    tree = createQuadTree(points, x, y);
  }

  function vertexShader() {
    return [
      'attribute vec3 color;',
      'varying vec3 vColor;',

      'attribute float size;',
      'uniform float scale;',
      '',
      'void main() {',
      '  vColor = color;',
      '  vec4 mvPosition = modelViewMatrix * vec4( position.xy, 0.0, 1.0 );',
      '  gl_PointSize = max(1.0, size * ( scale / - mvPosition.z ));',
      '  gl_Position = projectionMatrix * mvPosition;',
      '}'
    ].join('\n');
  }

  function fragmentShader() {
    return [
      'uniform sampler2D texture;',
      'varying vec3 vColor;',
      '',
      'void main() {',
      '  vec4 tColor = texture2D( texture, gl_PointCoord );',
      '  if (tColor.a < 0.5) discard;',
      '  gl_FragColor = vec4(vColor.rgb, 1. );',
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

function x(p) {
  return p.x;
}

function y(p) {
  return p.y;
}

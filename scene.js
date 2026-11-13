/* Motion layer for the invitation: three.js petals, hearts, sparkles, ribbons
   and a burst when the envelope opens. Exposes window.inviteScene.burst().
   If three.js or WebGL is unavailable the page falls back to its CSS petals. */
(function () {
  'use strict';
  var THREE = window.THREE;
  var canvas = document.getElementById('scene');
  if (!THREE || !canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (e) { return; }

  var small = Math.min(window.innerWidth, window.innerHeight) < 600;
  var px = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(px);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  camera.position.z = 10;
  var W = 10, H = 10; // visible world size at z = 0

  scene.add(new THREE.HemisphereLight(0xffffff, 0xf4a9c4, 1.05));
  var sun = new THREE.DirectionalLight(0xfff1d6, 0.55);
  sun.position.set(-3, 6, 8);
  scene.add(sun);

  var rand = function (a, b) { return a + Math.random() * (b - a); };
  var dummy = new THREE.Object3D();
  var PINKS = [0xffffff, 0xfbd3e1, 0xf59abb, 0xe56f9a, 0xd8c6f0, 0xf7b9d0];

  /* ---------- petals ---------- */
  var petalShape = new THREE.Shape();
  petalShape.moveTo(0, -0.6);
  petalShape.bezierCurveTo(0.55, -0.3, 0.5, 0.45, 0, 0.6);
  petalShape.bezierCurveTo(-0.5, 0.45, -0.55, -0.3, 0, -0.6);
  var petalGeo = new THREE.ShapeGeometry(petalShape, 10);
  (function cup(pos) {
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, 0.55 * x * x + 0.18 * y * y);
    }
    petalGeo.computeVertexNormals();
  })(petalGeo.attributes.position);

  var PETALS = small ? 70 : 120;
  var petals = new THREE.InstancedMesh(petalGeo,
    new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.92 }), PETALS);
  var P = [];
  var col = new THREE.Color();
  for (var i = 0; i < PETALS; i++) {
    P.push({
      x: 0, y: 0, z: 0, s: rand(0.16, 0.34),
      fall: rand(0.5, 1.3), sway: rand(0.3, 1), freq: rand(0.4, 1.1), ph: rand(0, 6.28),
      rx: rand(0, 6.28), ry: rand(0, 6.28), rz: rand(0, 6.28),
      vrx: rand(-1.6, 1.6), vry: rand(-1.2, 1.2), vrz: rand(-0.8, 0.8),
      bx: 0, by: 0, bz: 0
    });
    petals.setColorAt(i, col.setHex(PINKS[i % PINKS.length]));
  }
  scene.add(petals);
  function placePetal(p, anywhere) {
    p.x = rand(-W / 2 - 1, W / 2 + 1);
    p.y = anywhere ? rand(-H / 2, H / 2 + 1) : H / 2 + rand(0.5, 3);
    p.z = rand(-4, 3);
  }

  /* ---------- hearts drifting up the edges ---------- */
  var heartShape = new THREE.Shape();
  heartShape.moveTo(0, -0.55);
  heartShape.bezierCurveTo(-1.0, 0.1, -0.5, 0.8, 0, 0.3);
  heartShape.bezierCurveTo(0.5, 0.8, 1.0, 0.1, 0, -0.55);
  var heartGeo = new THREE.ExtrudeGeometry(heartShape, {
    depth: 0.18, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 3, curveSegments: 14
  });
  heartGeo.center();
  var HEARTS = small ? 8 : 14;
  var hearts = new THREE.InstancedMesh(heartGeo,
    new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.85 }), HEARTS);
  var Hs = [];
  var HEART_COLS = [0xf59abb, 0xe56f9a, 0xc9a8ec, 0xfbd3e1];
  for (i = 0; i < HEARTS; i++) {
    Hs.push({ side: i % 2 ? 1 : -1, edge: rand(0.62, 1.05), y: 0, z: rand(-5, 1), s: rand(0.16, 0.36),
      rise: rand(0.25, 0.6), ph: rand(0, 6.28), spin: rand(0.4, 1.2) });
    hearts.setColorAt(i, col.setHex(HEART_COLS[i % HEART_COLS.length]));
  }
  scene.add(hearts);

  /* ---------- sparkles (twinkling four-point stars) ---------- */
  var sparkVert = [
    'attribute float aSize; attribute float aPhase;',
    'uniform float uTime; uniform float uPx;',
    'varying float vA;',
    'void main(){',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  float tw = pow(0.5 + 0.5 * sin(uTime * (1.4 + fract(aPhase) * 2.2) + aPhase), 3.0);',
    '  vA = tw;',
    '  gl_PointSize = aSize * uPx * (0.35 + tw) * (10.0 / -mv.z);',
    '  gl_Position = projectionMatrix * mv;',
    '}'].join('\n');
  var sparkFrag = [
    'precision mediump float;',
    'uniform vec3 uColor; varying float vA;',
    'void main(){',
    '  vec2 p = gl_PointCoord - 0.5;',
    '  float core = smoothstep(0.14, 0.0, length(p));',
    '  float rays = max(0.0, 1.0 - abs(p.x) * 36.0) * smoothstep(0.5, 0.0, abs(p.y))',
    '             + max(0.0, 1.0 - abs(p.y) * 36.0) * smoothstep(0.5, 0.0, abs(p.x));',
    '  float a = clamp(core + rays * 0.85, 0.0, 1.0) * vA;',
    '  if (a < 0.02) discard;',
    '  gl_FragColor = vec4(uColor, a);',
    '}'].join('\n');
  function sparkMaterial(hex) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: px }, uColor: { value: new THREE.Color(hex) } },
      vertexShader: sparkVert, fragmentShader: sparkFrag, transparent: true, depthWrite: false
    });
  }
  function sparkField(n, hex, sizeLo, sizeHi) {
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 3), size = new Float32Array(n), phase = new Float32Array(n);
    for (var k = 0; k < n; k++) { size[k] = rand(sizeLo, sizeHi); phase[k] = rand(0, 100); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    var pts = new THREE.Points(g, sparkMaterial(hex));
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  }
  var goldSparks = sparkField(small ? 90 : 170, 0xc39a45, 14, 34);
  var pinkSparks = sparkField(small ? 50 : 90, 0xe56f9a, 10, 24);
  function scatter(pts) {
    var a = pts.geometry.attributes.position;
    for (var k = 0; k < a.count; k++) a.setXYZ(k, rand(-W / 2, W / 2), rand(-H / 2, H / 2), rand(-5, 3));
    a.needsUpdate = true;
  }

  /* ---------- burst sparks (envelope opening) ---------- */
  var BURST = 140;
  var burstPts = sparkField(BURST, 0xd9b25c, 0, 0);
  var B = [];
  for (i = 0; i < BURST; i++) B.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, size: 0 });

  /* ---------- ribbons ---------- */
  function ribbon(hex, y, speed, phase) {
    var geo = new THREE.PlaneGeometry(1, 1, 90, 1);
    var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: hex, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false
    }));
    mesh.userData = { y: y, speed: speed, phase: phase };
    scene.add(mesh);
    return mesh;
  }
  var ribbons = [
    ribbon(0xf59abb, 0.36, 0.55, 0), ribbon(0xd8c6f0, 0.40, 0.42, 2.1),
    ribbon(0xe6cf9a, -0.38, 0.5, 4.2), ribbon(0xf7b9d0, -0.42, 0.37, 1.1)
  ];
  function waveRibbon(m, t) {
    var a = m.geometry.attributes.position, u = m.userData, n = a.count / 2;
    for (var k = 0; k < n; k++) {
      var f = k / (n - 1);
      var x = (f - 0.5) * (W + 4);
      var w = t * u.speed + u.phase;
      var cy = u.y * H + Math.sin(x * 0.55 + w) * 0.55 + Math.sin(x * 1.3 - w * 1.4) * 0.22;
      var cz = -2 + Math.cos(x * 0.7 + w * 1.1) * 1.2;
      var tw = x * 0.9 + w * 1.6; // twist along the length
      var hw = 0.16 + 0.1 * Math.sin(x * 0.4 + w);
      a.setXYZ(k, x, cy + Math.cos(tw) * hw, cz + Math.sin(tw) * hw);
      a.setXYZ(k + n, x, cy - Math.cos(tw) * hw, cz - Math.sin(tw) * hw);
    }
    a.needsUpdate = true;
  }

  /* ---------- expanding rings ---------- */
  var rings = [];
  [0xc39a45, 0xe56f9a, 0xffffff].forEach(function (hex, k) {
    var r = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 96),
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, depthWrite: false }));
    r.userData = { t: -1, delay: k * 0.16 };
    r.visible = false;
    scene.add(r);
    rings.push(r);
  });

  /* ---------- layout ---------- */
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    H = 2 * camera.position.z * Math.tan(camera.fov * Math.PI / 360);
    W = H * camera.aspect;
    scatter(goldSparks); scatter(pinkSparks);
    Hs.forEach(function (h2) { h2.y = rand(-H / 2, H / 2); });
  }
  resize();
  P.forEach(function (p) { placePetal(p, true); });
  window.addEventListener('resize', resize);

  /* ---------- parallax ---------- */
  var tx = 0, ty = 0;
  window.addEventListener('pointermove', function (e) {
    tx = (e.clientX / window.innerWidth - 0.5) * 0.8;
    ty = (e.clientY / window.innerHeight - 0.5) * -0.5;
  }, { passive: true });
  window.addEventListener('deviceorientation', function (e) {
    if (e.gamma == null) return;
    tx = Math.max(-1, Math.min(1, e.gamma / 35)) * 0.6;
    ty = Math.max(-1, Math.min(1, (e.beta - 45) / 35)) * -0.35;
  }, { passive: true });

  /* ---------- burst ---------- */
  var calm = 0.35; // petal activity: quiet before opening, full after
  function burst() {
    calm = 1;
    P.forEach(function (p, k) {
      if (k % 4 === 3) return; // leave some falling
      var ang = rand(0, 6.28), sp = rand(2.5, 9);
      p.x = rand(-0.4, 0.4); p.y = rand(-0.5, 0.3); p.z = rand(0, 2.5);
      p.bx = Math.cos(ang) * sp; p.by = Math.sin(ang) * sp + 2.5; p.bz = rand(-2, 3);
    });
    B.forEach(function (b) {
      var ang = rand(0, 6.28), sp = rand(1.5, 8);
      b.x = 0; b.y = -0.2; b.z = 1.5;
      b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp + 1.5; b.vz = rand(-1.5, 2.5);
      b.life = rand(1.1, 2.4); b.size = rand(18, 44);
    });
    rings.forEach(function (r) { r.userData.t = -r.userData.delay; r.visible = true; });
  }

  /* ---------- frame ---------- */
  var clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, k;

    camera.position.x += (tx - camera.position.x) * 0.04;
    camera.position.y += (ty - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    var drag = Math.exp(-1.7 * dt);
    for (k = 0; k < PETALS; k++) {
      var p = P[k];
      p.x += (Math.sin(t * p.freq + p.ph) * p.sway * calm + p.bx) * dt;
      p.y += (-p.fall * calm + p.by) * dt;
      p.z += p.bz * dt;
      p.bx *= drag; p.by *= drag; p.bz *= drag;
      p.rx += p.vrx * dt; p.ry += p.vry * dt; p.rz += p.vrz * dt;
      if (p.y < -H / 2 - 1 || Math.abs(p.x) > W / 2 + 3) placePetal(p, false);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      petals.setMatrixAt(k, dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;

    for (k = 0; k < HEARTS; k++) {
      var h = Hs[k];
      h.y += h.rise * dt;
      if (h.y > H / 2 + 1) { h.y = -H / 2 - 1; h.edge = rand(0.62, 1.05); }
      dummy.position.set(h.side * h.edge * W / 2 + Math.sin(t * 0.6 + h.ph) * 0.3, h.y, h.z);
      dummy.rotation.set(0, Math.sin(t * h.spin + h.ph) * 0.9, Math.sin(t * 0.8 + h.ph) * 0.25);
      dummy.scale.setScalar(h.s * (1 + 0.08 * Math.sin(t * 3 + h.ph)));
      dummy.updateMatrix();
      hearts.setMatrixAt(k, dummy.matrix);
    }
    hearts.instanceMatrix.needsUpdate = true;

    goldSparks.material.uniforms.uTime.value = t;
    pinkSparks.material.uniforms.uTime.value = t + 40;
    goldSparks.position.y = Math.sin(t * 0.15) * 0.4;
    pinkSparks.position.x = Math.sin(t * 0.11) * 0.5;

    var bp = burstPts.geometry.attributes.position, bs = burstPts.geometry.attributes.aSize;
    burstPts.material.uniforms.uTime.value = t * 3;
    for (k = 0; k < BURST; k++) {
      var b = B[k];
      if (b.life > 0) {
        b.life -= dt;
        b.vy -= 3.2 * dt;
        b.vx *= drag; b.vz *= drag;
        b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      }
      bp.setXYZ(k, b.x, b.y, b.z);
      bs.setX(k, b.life > 0 ? b.size * Math.min(1, b.life) : 0);
    }
    bp.needsUpdate = true; bs.needsUpdate = true;

    for (k = 0; k < ribbons.length; k++) waveRibbon(ribbons[k], t);

    for (k = 0; k < rings.length; k++) {
      var r = rings[k], u = r.userData;
      if (!r.visible) continue;
      u.t += dt;
      var q = u.t / 1.5;
      if (q >= 1) { r.visible = false; continue; }
      if (q < 0) { r.material.opacity = 0; continue; }
      var e = 1 - Math.pow(1 - q, 3);
      r.scale.setScalar(0.4 + e * Math.max(W, H) * 0.75);
      r.material.opacity = (1 - q) * 0.8;
    }

    renderer.render(scene, camera);
  }
  frame();

  window.inviteScene = { burst: burst };
})();

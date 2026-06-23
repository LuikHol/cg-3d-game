/* ================================================================
   game.js – inicialização WebGL, cena e loop principal

   Dependências (carregadas antes no index.html):
     • glMatrix 2.8   – mat3, mat4, vec3
     • shaders.js     – VERT_SRC, FRAG_SRC
     • geometry.js    – createBoxGeometry(), createDiscGeometry(), createTorusGeometry()
     • obj-loader.js  – loadOBJ(), uploadOBJMesh(), bindOBJMesh(), drawOBJMesh()
     • input.js       – Input.isDown()
     • city.js        – City
     • mission.js     – Mission
     • renderer.js    – Renderer
   ================================================================ */

(function () {
  'use strict';

  /* ── 1. Canvas & contexto WebGL ──────────────────────────────── */

  const canvas = document.getElementById('canvas');

  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const gl = canvas.getContext('webgl');
  if (!gl) {
    document.body.innerHTML =
      '<p style="color:red;padding:30px;font-size:20px">WebGL não suportado neste navegador.</p>';
    return;
  }

  /* ── 2. Compilação e link dos shaders ───────────────────────── */

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error('Shader compile:\n' + gl.getShaderInfoLog(s));
    return s;
  }

  function createProgram(vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER,   vsSrc));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error('Program link:\n' + gl.getProgramInfoLog(p));
    return p;
  }

  const prog = createProgram(VERT_SRC, FRAG_SRC);
  gl.useProgram(prog);

  /* ── 3. Localização de atributos e uniforms ─────────────────── */

  const loc = {
    aPos  : gl.getAttribLocation (prog, 'aPosition'),
    aNorm : gl.getAttribLocation (prog, 'aNormal'),
    aUV   : gl.getAttribLocation (prog, 'aUV'),
    uModel    : gl.getUniformLocation(prog, 'uModel'),
    uView     : gl.getUniformLocation(prog, 'uView'),
    uProj     : gl.getUniformLocation(prog, 'uProj'),
    uNormalMat: gl.getUniformLocation(prog, 'uNormalMat'),
    uLightPos : gl.getUniformLocation(prog, 'uLightPos'),
    uEyePos   : gl.getUniformLocation(prog, 'uEyePos'),
    uColor    : gl.getUniformLocation(prog, 'uColor'),
    uAlpha    : gl.getUniformLocation(prog, 'uAlpha'),
    uTex      : gl.getUniformLocation(prog, 'uTex'),
    uUseTex   : gl.getUniformLocation(prog, 'uUseTex'),
    uUnlit    : gl.getUniformLocation(prog, 'uUnlit'),
    uAmbient        : gl.getUniformLocation(prog, 'uAmbient'),
    uLightIntensity : gl.getUniformLocation(prog, 'uLightIntensity'),
    uEmissive       : gl.getUniformLocation(prog, 'uEmissive'),
    uSpecular       : gl.getUniformLocation(prog, 'uSpecular'),
    uTreeMode       : gl.getUniformLocation(prog, 'uTreeMode'),
    uTreeTrunkTop   : gl.getUniformLocation(prog, 'uTreeTrunkTop'),
    uFogColor       : gl.getUniformLocation(prog, 'uFogColor'),
    uFogNear        : gl.getUniformLocation(prog, 'uFogNear'),
    uFogFar         : gl.getUniformLocation(prog, 'uFogFar'),
  };
  gl.uniform1f(gl.getUniformLocation(prog, 'uAlpha'), 1.0);
  gl.uniform1i(loc.uTex, 0);
  gl.uniform1f(loc.uUseTex, 0.0);
  gl.uniform1f(loc.uUnlit, 0.0);
  gl.uniform1f(loc.uAmbient,        0.25);
  gl.uniform1f(loc.uLightIntensity, 1.0);
  gl.uniform1f(loc.uTreeMode,       0.0);
  gl.uniform1f(loc.uTreeTrunkTop,   0.0);
  gl.uniform3f(loc.uFogColor, 0.48, 0.66, 0.78);
  gl.uniform1f(loc.uFogNear, 55.0);
  gl.uniform1f(loc.uFogFar,  180.0);

  /* ── 4. Buffers de geometria ────────────────────────────────── */

  /* Cubo */
  const geo    = createBoxGeometry();
  const posVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
  gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
  const normVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normVBO);
  gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);
  const uvVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvVBO);
  gl.bufferData(gl.ARRAY_BUFFER, geo.uvs, gl.STATIC_DRAW);
  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
  const IDX_COUNT = geo.indices.length; // 36

  /* Disco */
  const discGeo     = createDiscGeometry(40);
  const discPosVBO  = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, discPosVBO);
  gl.bufferData(gl.ARRAY_BUFFER, discGeo.positions, gl.STATIC_DRAW);
  const discNormVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, discNormVBO);
  gl.bufferData(gl.ARRAY_BUFFER, discGeo.normals, gl.STATIC_DRAW);
  const DISC_COUNT = discGeo.count;

  /* Toro */
  const torusGeo   = createTorusGeometry(56, 14, 0.08);
  const torPosVBO  = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, torPosVBO);
  gl.bufferData(gl.ARRAY_BUFFER, torusGeo.positions, gl.STATIC_DRAW);
  const torNormVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, torNormVBO);
  gl.bufferData(gl.ARRAY_BUFFER, torusGeo.normals, gl.STATIC_DRAW);
  const torIdxBuf  = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, torIdxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, torusGeo.indices, gl.STATIC_DRAW);
  const TOR_IDX_COUNT = torusGeo.indices.length;

  /* Árvore OBJ (carregada de forma assíncrona) */
  let treeMesh = null;
  loadOBJ('js/objects/arvore.obj')
    .then(parsed => { treeMesh = uploadOBJMesh(gl, parsed); })
    .catch(err   => { console.error('Falha ao carregar árvore OBJ:', err); });
  
  /* Carro OBJ (carregado de forma assíncrona) */
  let carMesh  = null;
  loadOBJ('js/objects/Car.obj')
    .then(parsed => { carMesh = uploadOBJMesh(gl, parsed); })
    .catch(err   => { console.error('Falha ao carregar carro OBJ:', err); });

  /* Banco OBJ (carregado de forma assíncrona) */
  let benchMesh = null;
  loadOBJ('js/objects/Bench_LowRes.obj')
    .then(parsed => { benchMesh = uploadOBJMesh(gl, parsed); })
    .catch(err   => { console.error('Falha ao carregar banco OBJ:', err); });

  /* Lixeira OBJ (carregada de forma assíncrona) */
  let trashMesh = null;
  loadOBJ('js/objects/caixa%20de%20lixo.obj')
    .then(parsed => { trashMesh = uploadOBJMesh(gl, parsed); })
    .catch(err   => { console.error('Falha ao carregar lixeira OBJ:', err); });

  /* Seta OBJ (carregada de forma assíncrona) */
  window._arrowMesh = null;
  loadOBJ('js/objects/Arrow.obj')
    .then(parsed => { window._arrowMesh = uploadOBJMesh(gl, parsed); })
    .catch(err   => { console.error('Falha ao carregar seta OBJ:', err); });

  /* Drone OBJ (carregada de forma assíncrona) */
  window._droneMesh = null;
  window._droneHelices = null;
  loadOBJ('js/objects/drone.obj')
    .then(parsed => { window._droneMesh = uploadOBJMesh(gl, parsed); })
    .catch(err   => { console.error('Falha ao carregar drone OBJ:', err); });

  /* Hélices individuais */
  Promise.all(['helix1','helix2','helix3','helix4'].map(name =>
    loadOBJ(`js/objects/${name}.obj`)
      .then(parsed => ({ name, mesh: uploadOBJMesh(gl, parsed) }))
      .catch(() => null)
  )).then(results => {
    const helices = {};
    for (const r of results) if (r) helices[r.name] = r.mesh;
    if (Object.keys(helices).length > 0) window._droneHelices = helices;
  });

  /* Bind helpers – reativam os VBOs corretos para cada tipo de malha */
  function bindMesh() {
    gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, normVBO);
    gl.enableVertexAttribArray(loc.aNorm);
    gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 0, 0);
    if (loc.aUV >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, uvVBO);
      gl.enableVertexAttribArray(loc.aUV);
      gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  }
  function bindDisc() {
    gl.bindBuffer(gl.ARRAY_BUFFER, discPosVBO);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, discNormVBO);
    gl.enableVertexAttribArray(loc.aNorm);
    gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 0, 0);
    if (loc.aUV >= 0) {
      gl.disableVertexAttribArray(loc.aUV);
      gl.vertexAttrib2f(loc.aUV, 0.0, 0.0);
    }
  }
  function bindTorus() {
    gl.bindBuffer(gl.ARRAY_BUFFER, torPosVBO);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, torNormVBO);
    gl.enableVertexAttribArray(loc.aNorm);
    gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 0, 0);
    if (loc.aUV >= 0) {
      gl.disableVertexAttribArray(loc.aUV);
      gl.vertexAttrib2f(loc.aUV, 0.0, 0.0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, torIdxBuf);
  }

  /* ── 5. Matrizes e vetores reutilizáveis ────────────────────── */

  const modelMat = mat4.create();
  const viewMat  = mat4.create();
  const projMat  = mat4.create();
  const normMat3 = mat3.create();
  const camPos   = vec3.create();
  const lightPos = vec3.create();
  const fwdVec   = vec3.create();

  /* ── 6. Pointer Lock ────────────────────────────────────────── */

  let mouseLocked = false;
  let paused      = false;

  function setPaused(val) {
    paused = val;
    hudPause.style.display = paused ? 'flex' : 'none';
    minimap.setOpacity(paused);
    if (paused && document.pointerLockElement === canvas) document.exitPointerLock();
    if (!paused) canvas.requestPointerLock();
  }

  canvas.addEventListener('click', () => { if (!paused) canvas.requestPointerLock(); });

  document.addEventListener('pointerlockchange', () => {
    mouseLocked = document.pointerLockElement === canvas;
    if (!mouseLocked && !paused) setPaused(true);
  });

  window.addEventListener('keydown', e => { if (e.code === 'KeyP') setPaused(!paused); });

  let mouseDX = 0, mouseDY = 0;
  document.addEventListener('mousemove', e => {
    if (mouseLocked) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });

  /* ── 7. Estado do drone ─────────────────────────────────────── */

  const drone = {
    pos         : vec3.fromValues(0, 3, 0),
    vel         : vec3.fromValues(0, 0, 0),
    yaw         : 0,
    camPitch    : 0.35,
    tiltPitch   : 0,
    tiltRoll    : 0,
    SPEED       : 10,
    VSPEED      : 12,
    ACCEL       : 28,
    DRAG        :  2.2,
    VDRAG       :  3.0,
    boostVel    : [0, 0, 0],
    BOOST_DRAG  :  0.55,
    GRAVITY     :  2.0,
    SENSITIVITY : 0.0018,
    CAM_DIST    : 9,
    MAX_TILT    : 0.28,
    TILT_SPEED  : 5.0,
    camPitchNudge: 0,
  };

  /* ── 8. Inicializa módulos ───────────────────────────────────── */

  Mission.init(drone);
  Renderer.init(drone, gl);
  City.buildTrees(Mission.MISSION_DEFS);

  /* ── 9. Ciclo dia/noite e HUD ───────────────────────────────── */

  let   timeOfDay = 0.38;       // 0=meia-noite · 0.25=nascer · 0.5=meio-dia
  const DAY_SPEED = 1 / 480;   // ciclo completo em ~8 min reais

  const hudPos   = document.getElementById('hud-pos');
  const hudPause = document.getElementById('hud-pause');

  const sensSlider = document.getElementById('sens-slider');
  const sensValue  = document.getElementById('sens-value');
  sensSlider.addEventListener('input', () => {
    const v = Number(sensSlider.value);
    sensValue.textContent = v;
    drone.SENSITIVITY = v * 0.0002;
  });

  const timeSlider = document.getElementById('time-slider');
  const timeValue  = document.getElementById('time-value');
  timeSlider.addEventListener('input', () => {
    timeOfDay = Number(timeSlider.value) / 1000;
  });

  hudPause.addEventListener('click', e => { if (e.target === hudPause) setPaused(false); });

  const minimap = new MiniMap(200, 200);
  minimap.initCityLayer(City);

  paused = true;
  hudPause.style.display = 'flex';

  /* ── 10. Loop principal ─────────────────────────────────────── */

  let lastT     = 0;
  let frameTime = 0;

  function frame(now) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    frameTime += dt;

    /* Avança ciclo dia/noite */
    if (!paused) timeOfDay = (timeOfDay + DAY_SPEED * dt) % 1.0;
    if (document.activeElement !== timeSlider)
      timeSlider.value = Math.round(timeOfDay * 1000);
    const _th = Math.floor(timeOfDay * 24);
    const _tm = Math.floor((timeOfDay * 24 * 60) % 60);
    timeValue.textContent = String(_th).padStart(2, '0') + ':' + String(_tm).padStart(2, '0');

    if (paused) { mouseDX = 0; requestAnimationFrame(frame); return; }

    /* ── Mouse → yaw + pitch ────────────────────────────────── */
    if (mouseLocked) {
      drone.yaw      -= mouseDX * drone.SENSITIVITY;
      drone.camPitch += mouseDY * drone.SENSITIVITY;
      drone.camPitch  = Math.max(-0.08, Math.min(1.45, drone.camPitch));
    }
    mouseDX = 0;
    mouseDY = 0;

    /* ── Direções ───────────────────────────────────────────── */
    fwdVec[0] = -Math.sin(drone.yaw);
    fwdVec[1] =  0;
    fwdVec[2] = -Math.cos(drone.yaw);
    const rightX =  Math.cos(drone.yaw);
    const rightZ = -Math.sin(drone.yaw);

    /* ── Input ──────────────────────────────────────────────── */
    const movW    = Input.isDown('KeyW');
    const movS    = Input.isDown('KeyS');
    const movA    = Input.isDown('KeyA');
    const movD    = Input.isDown('KeyD');
    const movUp   = Input.isDown('Space');
    const movDown = Input.isDown('ShiftLeft') || Input.isDown('ShiftRight');

    /* ── Física ─────────────────────────────────────────────── */
    let ax = 0, az = 0, ay = 0;
    if (movW) { ax += fwdVec[0] * drone.ACCEL; az += fwdVec[2] * drone.ACCEL; }
    if (movS) { ax -= fwdVec[0] * drone.ACCEL; az -= fwdVec[2] * drone.ACCEL; }
    if (movA) { ax -= rightX * drone.ACCEL;     az -= rightZ * drone.ACCEL; }
    if (movD) { ax += rightX * drone.ACCEL;     az += rightZ * drone.ACCEL; }
    if (movUp)   ay =  drone.ACCEL;
    if (movDown) ay = -drone.ACCEL;

    const hspd0    = Math.sqrt(drone.vel[0] ** 2 + drone.vel[2] ** 2);
    const gravScale = 1.0 - Math.min(hspd0 / drone.SPEED, 1.0) * 0.75;
    ay -= drone.GRAVITY * gravScale;

    drone.vel[0] += (ax - drone.DRAG  * drone.vel[0]) * dt;
    drone.vel[2] += (az - drone.DRAG  * drone.vel[2]) * dt;
    drone.vel[1] += (ay - drone.VDRAG * drone.vel[1]) * dt;

    drone.boostVel[0] -= drone.boostVel[0] * drone.BOOST_DRAG * dt;
    drone.boostVel[1] -= drone.boostVel[1] * drone.BOOST_DRAG * dt;
    drone.boostVel[2] -= drone.boostVel[2] * drone.BOOST_DRAG * dt;

    const hspd = Math.sqrt(drone.vel[0] ** 2 + drone.vel[2] ** 2);
    if (hspd > drone.SPEED) {
      drone.vel[0] = drone.vel[0] / hspd * drone.SPEED;
      drone.vel[2] = drone.vel[2] / hspd * drone.SPEED;
    }
    drone.vel[1] = Math.max(-drone.VSPEED, Math.min(drone.VSPEED, drone.vel[1]));

    const oldDronePos = [drone.pos[0], drone.pos[1], drone.pos[2]];
    drone.pos[0] += (drone.vel[0] + drone.boostVel[0]) * dt;
    drone.pos[1] += (drone.vel[1] + drone.boostVel[1]) * dt;
    drone.pos[2] += (drone.vel[2] + drone.boostVel[2]) * dt;

    if (drone.pos[1] < 0.3) { drone.pos[1] = 0.3; drone.vel[1] = 0; }
    if (drone.pos[1] > 150) { drone.pos[1] = 150; drone.vel[1] = 0; drone.boostVel[1] = 0; }

    /* ── Colisão ────────────────────────────────────────────── */
    const PLAYER_HALF_SIZE   = 1.3;
    const PLAYER_HALF_HEIGHT = 1.7;
    const collision = City.resolveCollision(drone.pos, oldDronePos, PLAYER_HALF_SIZE, PLAYER_HALF_HEIGHT);
    if (collision.hitX) drone.vel[0] = 0;
    if (collision.hitZ) drone.vel[2] = 0;

    Mission.update(dt);

    /* ── Tilt visual ────────────────────────────────────────── */
    const vFwd    =  drone.vel[0] * fwdVec[0] + drone.vel[2] * fwdVec[2];
    const vRight  =  drone.vel[0] * rightX    + drone.vel[2] * rightZ;
    const tpTarget = (vFwd   / drone.SPEED) *  drone.MAX_TILT;
    const trTarget = (vRight / drone.SPEED) * -drone.MAX_TILT;
    drone.tiltPitch += (tpTarget - drone.tiltPitch) * drone.TILT_SPEED * dt;
    drone.tiltRoll  += (trTarget - drone.tiltRoll)  * drone.TILT_SPEED * dt;

    /* ── Nudge vertical da câmera ───────────────────────────── */
    const nudgeTarget = -(drone.vel[1] / drone.VSPEED) * 0.18;
    drone.camPitchNudge += (nudgeTarget - drone.camPitchNudge) * 6 * dt;

    /* ── Câmera orbital ─────────────────────────────────────── */
    const hDist          = Math.cos(drone.camPitch) * drone.CAM_DIST;
    const effectivePitch = drone.camPitch + drone.camPitchNudge;
    camPos[0] = drone.pos[0] + Math.sin(drone.yaw) * hDist;
    camPos[1] = drone.pos[1] + Math.sin(effectivePitch) * drone.CAM_DIST;
    camPos[2] = drone.pos[2] + Math.cos(drone.yaw) * hDist;
    mat4.lookAt(viewMat, camPos, drone.pos, [0, 1, 0]);
    mat4.perspective(projMat, Math.PI / 3, canvas.width / canvas.height, 0.1, 600);

    if (hudPos)
      hudPos.textContent =
        `X: ${drone.pos[0].toFixed(1)} \u00a0 ` +
        `Y: ${drone.pos[1].toFixed(1)} \u00a0 ` +
        `Z: ${drone.pos[2].toFixed(1)}`;

    /* ── Sol, lua e iluminação ──────────────────────────────── */
    const _sunAngle  = (timeOfDay - 0.25) * Math.PI * 2;
    const _sunHeight = Math.sin(_sunAngle);
    const _sunX      = Math.cos(_sunAngle) * Renderer.LIGHT_R;
    const _sunY      = _sunHeight          * Renderer.LIGHT_R;
    const _sunZ      = Math.sin(_sunAngle * 0.4 + 1.0) * 35;

    const _moonAngle = _sunAngle + Math.PI * 1.04;
    const _moonX     = Math.cos(_moonAngle) * Renderer.LIGHT_R * 0.92;
    const _moonY     = Math.sin(_moonAngle) * Renderer.LIGHT_R * 0.82;
    const _moonZ     = Math.sin(_moonAngle * 0.35 + 0.8) * 40;

    const _nightBlend = Math.max(0, Math.min(1, -_sunHeight * 3.0 + 0.25));
    lightPos[0] = _sunX * (1 - _nightBlend) + _moonX * _nightBlend;
    lightPos[1] = _sunY * (1 - _nightBlend) + _moonY * _nightBlend;
    lightPos[2] = _sunZ * (1 - _nightBlend) + _moonZ * _nightBlend;

    const _ambientVal = 0.12 + Math.max(0, _sunHeight) * 0.22 + _nightBlend * 0.06;
    const _sky        = Renderer.skyColor(timeOfDay);
    const _fogNear    = 48.0 - _nightBlend * 6.0;
    const _fogFar     = 170.0 - _nightBlend * 12.0;

    /* ── Estado WebGL ───────────────────────────────────────── */
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(_sky[0], _sky[1], _sky[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.uniformMatrix4fv(loc.uView, false, viewMat);
    gl.uniformMatrix4fv(loc.uProj, false, projMat);
    gl.uniform3fv(loc.uLightPos, lightPos);
    gl.uniform3fv(loc.uEyePos,   camPos);
    gl.uniform1f(loc.uAmbient,        _ambientVal);
    gl.uniform1f(loc.uLightIntensity, 1.0 - _nightBlend * 0.85);
    gl.uniform3f(loc.uFogColor,
      _sky[0] * 0.82 + 0.06,
      _sky[1] * 0.82 + 0.06,
      _sky[2] * 0.84 + 0.06
    );
    gl.uniform1f(loc.uFogNear, _fogNear);
    gl.uniform1f(loc.uFogFar,  _fogFar);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    gl.uniform1f(loc.uAlpha,    1.0);
    gl.uniform1f(loc.uSpecular, 1.0);

    /* ── Render context (passado a todos os módulos de draw) ── */
    const rc = {
      gl, loc, modelMat, viewMat, normMat3, camPos,
      IDX_COUNT, DISC_COUNT, TOR_IDX_COUNT,
      bindMesh, bindDisc, bindTorus,
      frameTime,
      get treeMesh()  { return treeMesh;  },  // lazy: ainda null após init
      get carMesh()   { return carMesh;   },  // lazy: ainda null após init
      get benchMesh() { return benchMesh; },  // lazy: ainda null após init
      get trashMesh() { return trashMesh; },  // lazy: ainda null após init
      get timeOfDay() { return timeOfDay; },  // mutable: Renderer.drawSkyObjects precisa
    };

    /* ── Cena ───────────────────────────────────────────────── */
    bindMesh();
    Renderer.drawSkyObjects(rc, _sunHeight, _nightBlend, _sunX, _sunY, _sunZ);
    bindMesh(); // restaura após drawSkyObjects

    Renderer.drawGroundAndRoads(rc, _nightBlend);
    City.drawPark(rc, frameTime, _nightBlend);
    City.drawCityProps(rc, _nightBlend);
    City.drawCars(rc);

    gl.uniform1f(loc.uSpecular, 0.06);   // prédios: quase matte
    City.drawBuildings(rc, _nightBlend);
    City.drawBuildingLights(rc, frameTime, _nightBlend);
    City.drawTrees(rc, frameTime, _nightBlend);
    bindMesh();
    gl.uniform1f(loc.uSpecular, 1.0);    // restaura

    Renderer.drawDrone(rc);
    Mission.draw(rc);

    minimap.draw(drone.pos, Mission.state);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
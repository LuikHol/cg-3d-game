/* ================================================================
   game.js – inicialização WebGL, cena e loop principal

   Dependências (carregadas antes no index.html):
     • glMatrix 2.8  – álgebra linear (mat3, mat4, vec3)
     • shaders.js    – VERT_SRC, FRAG_SRC
     • geometry.js   – createBoxGeometry()
     • input.js      – Input.isDown()
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

  /** @type {WebGLRenderingContext} */
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
    /* atributos */
    aPos  : gl.getAttribLocation (prog, 'aPosition'),
    aNorm : gl.getAttribLocation (prog, 'aNormal'),
    /* uniforms de transformação */
    uModel    : gl.getUniformLocation(prog, 'uModel'),
    uView     : gl.getUniformLocation(prog, 'uView'),
    uProj     : gl.getUniformLocation(prog, 'uProj'),
    uNormalMat: gl.getUniformLocation(prog, 'uNormalMat'),
    /* uniforms de iluminação */
    uLightPos : gl.getUniformLocation(prog, 'uLightPos'),
    uEyePos   : gl.getUniformLocation(prog, 'uEyePos'),
    uColor    : gl.getUniformLocation(prog, 'uColor'),
    uAlpha    : gl.getUniformLocation(prog, 'uAlpha'),
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
  gl.uniform1f(gl.getUniformLocation(prog, 'uAlpha'), 1.0); // default opaco
  gl.uniform1f(loc.uAmbient,  0.25);                        // default dia
  gl.uniform1f(loc.uLightIntensity, 1.0);                   // default dia pleno
  gl.uniform1f(loc.uTreeMode, 0.0);                         // default: modo normal
  gl.uniform1f(loc.uTreeTrunkTop, 0.0);
  gl.uniform3f(loc.uFogColor, 0.48, 0.66, 0.78);
  gl.uniform1f(loc.uFogNear, 55.0);
  gl.uniform1f(loc.uFogFar, 180.0);

  /* ── 4. Buffers do cubo compartilhado ───────────────────────── */

  const geo = createBoxGeometry();

  const posVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
  gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);

  const normVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normVBO);
  gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);

  const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);

  const IDX_COUNT = geo.indices.length; // 36

  /* ── Disco (zonas de coleta/entrega) ────────────────────────── */
  const discGeo = createDiscGeometry(40);
  const discPosVBO  = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, discPosVBO);
  gl.bufferData(gl.ARRAY_BUFFER, discGeo.positions, gl.STATIC_DRAW);
  const discNormVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, discNormVBO);
  gl.bufferData(gl.ARRAY_BUFFER, discGeo.normals, gl.STATIC_DRAW);
  const DISC_COUNT = discGeo.count;

  /* ── Toro (aros da missão) ───────────────────────────────────── */
  const torusGeo  = createTorusGeometry(56, 14, 0.08); // tubeRatio 8%
  const torPosVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, torPosVBO);
  gl.bufferData(gl.ARRAY_BUFFER, torusGeo.positions, gl.STATIC_DRAW);
  const torNormVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, torNormVBO);
  gl.bufferData(gl.ARRAY_BUFFER, torusGeo.normals, gl.STATIC_DRAW);
  const torIdxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, torIdxBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, torusGeo.indices, gl.STATIC_DRAW);
  const TOR_IDX_COUNT = torusGeo.indices.length;

  /* ── Árvore OBJ (instanciada) ────────────────────────────────── */
  let treeMesh = null;
  loadOBJ('js/objects/Lowpoly_tree_sample.obj')
    .then(parsed => { treeMesh = uploadOBJMesh(gl, parsed); })
    .catch(err => { console.error('Falha ao carregar árvore OBJ:', err); });

  /* Ativa os atributos e aponta para os VBOs (feito uma vez,
     pois só existe um tipo de malha – o cubo). */
  function bindMesh() {
    gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, normVBO);
    gl.enableVertexAttribArray(loc.aNorm);
    gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
  }

  function bindDisc() {
    gl.bindBuffer(gl.ARRAY_BUFFER, discPosVBO);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, discNormVBO);
    gl.enableVertexAttribArray(loc.aNorm);
    gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 0, 0);
  }

  function bindTorus() {
    gl.bindBuffer(gl.ARRAY_BUFFER, torPosVBO);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, torNormVBO);
    gl.enableVertexAttribArray(loc.aNorm);
    gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, torIdxBuf);
  }

  /* ── 5. Matrizes e vetores reutilizáveis (evita alocação/frame) */

  const modelMat = mat4.create();  // matriz de modelo (world transform)
  const viewMat  = mat4.create();  // câmera (lookAt)
  const projMat  = mat4.create();  // projeção perspectiva
  const normMat3 = mat3.create();  // normal matrix (3×3)
  const camPos   = vec3.create();  // posição da câmera
  const lightPos = vec3.create();  // posição do sol
  const fwdVec   = vec3.create();  // forward do drone (calculado por frame)

  /* ── 6. Pointer Lock (mouse controla o yaw) ───────────────────── */

  let mouseLocked = false;
  let paused      = false;

  function setPaused(val) {
    paused = val;
    hudPause.style.display = paused ? 'flex' : 'none';
    if (paused && document.pointerLockElement === canvas)
      document.exitPointerLock();
    if (!paused)
      canvas.requestPointerLock();
  }

  /* Clique no canvas: captura mouse (só quando já despausado) */
  canvas.addEventListener('click', () => {
    if (!paused) canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    mouseLocked = document.pointerLockElement === canvas;
    /* Esc do navegador solta o pointer lock → pausa automaticamente */
    if (!mouseLocked && !paused) setPaused(true);
  });

  /* P → toggle pause */
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyP') setPaused(!paused);
  });

  /* Acumula movimento do mouse para usar no frame */
  let mouseDX = 0;
  let mouseDY = 0;
  document.addEventListener('mousemove', e => {
    if (mouseLocked) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
    }
  });

  /* ── 7-old. Estado do drone ──────────────────────────────────── */

  const drone = {
    pos        : vec3.fromValues(0, 3, 0),
    vel        : vec3.fromValues(0, 0, 0), // velocidade atual (m/s)
    yaw        : 0,
    camPitch   : 0.35,
    tiltPitch  : 0,
    tiltRoll   : 0,
    SPEED      : 10,    // velocidade máxima horizontal
    VSPEED     : 12,    // velocidade máxima vertical
    ACCEL      : 28,    // aceleração (m/s²) — chega ao máximo em ~0.35s
    DRAG       :  2.2,  // coef. de arrasto — para em ~0.7s
    VDRAG      :  3.0,  // arrasto vertical
    boostVel   : [0, 0, 0],  // impulso temporário do aro (decai sozinho)
    BOOST_DRAG :  0.55, // dissipa o boost em ~3s
    GRAVITY    :  2.0,  // queda livre suave (m/s²)
    SENSITIVITY: 0.0018,
    CAM_DIST   : 9,
    MAX_TILT   : 0.28,
    TILT_SPEED : 5.0,
    camPitchNudge: 0,   // nudge vertical da câmera baseado em vel Y
  };

  /* ═══════════════════════════════════════════════════════════════
     Sistema de Missão — múltiplas entregas sequenciais
     ═══════════════════════════════════════════════════════════════ */

  /* Definição de todas as missões disponíveis.
     Cada missão: pickup, delivery, e array de aros entre eles.
     Regras de posicionamento:
       - Hoops em corredores de rua (x=0,±40 ou z=0,±40) são seguros em qualquer altura.
       - Para áreas externas (|x|>50 ou |z|>50): sem prédios, seguro.
       - Mega-torre central (0,0) h=35: hoops acima de 36 são seguros em (0,0).
       - Prédios externos máximos: ~18u de altura.                  */
  const MISSION_DEFS = [
    /* ─── Missão 1 · Iniciante · 3 aros ───────────────────────────── */
    {
      decay   : 40,
      hitPad  : 0.80,
      pickup  : { x: -58, z: -58, r: 6 },
      delivery: { x:  58, z:  58, r: 6 },
      hoops: [
        { pos: [-40, 24, -40], radius: 7,   angle:  45, tilt:  0 },
        { pos: [  0, 82,   0], radius: 7,   angle:  45, tilt:  0 },
        { pos: [ 40, 24,  40], radius: 7,   angle:  45, tilt:  0 },
      ],
    },
    /* ─── Missão 2 · Fácil · 4 aros ────────────────────────────── */
    {
      decay   : 60,
      hitPad  : 0.55,
      pickup  : { x: -62, z:   0, r: 5 },
      delivery: { x:  62, z:   0, r: 5 },
      hoops: [
        { pos: [-40, 24,   0], radius: 6.5, angle:  90, tilt:  0 },
        { pos: [-15, 36,   0], radius: 6.5, angle:  90, tilt:  0 },
        { pos: [ 15, 36,   0], radius: 6.5, angle:  90, tilt:  0 },
        { pos: [ 40, 24,   0], radius: 6.5, angle:  90, tilt:  0 },
      ],
    },
    /* ─── Missão 3 · Médio · 5 aros ────────────────────────────── */
    {
      decay   : 85,
      hitPad  : 0.35,
      pickup  : { x: -62, z: -50, r: 5 },
      delivery: { x:  62, z:  50, r: 5 },
      hoops: [
        { pos: [-40, 22, -40], radius: 6,   angle:  45, tilt:   0 },
        { pos: [-20, 40, -20], radius: 6,   angle:  45, tilt:  20 },
        { pos: [  0, 82,   0], radius: 6,   angle:  45, tilt:   0 },
        { pos: [ 20, 40,  20], radius: 6,   angle:  45, tilt: -20 },
        { pos: [ 40, 22,  40], radius: 6,   angle:  45, tilt:   0 },
      ],
    },
    /* ─── Missão 4 · Difícil · 6 aros ──────────────────────────── */
    {
      decay   : 115,
      hitPad  : 0.20,
      pickup  : { x:  55, z: -62, r: 5 },
      delivery: { x: -55, z:  62, r: 5 },
      hoops: [
        { pos: [ 40, 24, -40], radius: 5.5, angle: 135, tilt:   0 },
        { pos: [ 40, 44, -12], radius: 5.5, angle:  90, tilt:  35 },
        { pos: [  0, 82,   0], radius: 5,   angle:  60, tilt:  20 },
        { pos: [-22, 60,   0], radius: 5,   angle: 100, tilt: -30 },
        { pos: [-40, 44,  12], radius: 5.5, angle:  90, tilt: -35 },
        { pos: [-40, 24,  40], radius: 5.5, angle: 135, tilt:   0 },
      ],
    },
    /* ─── Missão 5 · Expert · 8 aros ───────────────────────────── */
    {
      decay   : 160,
      hitPad  : 0.05,
      pickup  : { x:  68, z:  68, r: 5 },
      delivery: { x: -68, z: -68, r: 5 },
      hoops: [
        { pos: [ 55, 22,  55], radius: 4.5, angle: 225, tilt:   0 },
        { pos: [ 40, 28,  40], radius: 4.5, angle: 225, tilt:  25 },
        { pos: [ 20, 48,  15], radius: 4,   angle: 200, tilt:  40 },
        { pos: [  0, 76,   0], radius: 4,   angle:  15, tilt:  20 },
        { pos: [-12, 56, -18], radius: 4,   angle: 160, tilt: -40 },
        { pos: [-28, 40, -10], radius: 4,   angle: 250, tilt: -30 },
        { pos: [-40, 28, -40], radius: 4.5, angle: 225, tilt: -25 },
        { pos: [-55, 22, -55], radius: 4.5, angle: 225, tilt:   0 },
      ],
    },
  ];

  const FILL_TIME = 0.5;

  /* Estado da missão atual */
  let missionIdx = 0;

  function buildMissionState(idx) {
    const def = MISSION_DEFS[idx];
    /* Pré-calcula a normal de cada aro a partir do campo `angle` (graus) */
    def.hoops.forEach(h => {
      if (!h.normal) {
        const yaw   = (h.angle   || 0) * Math.PI / 180;
        const pitch = (h.tilt    || 0) * Math.PI / 180;
        // Normal do plano do aro: começa como +Z, rotaciona
        h.normal = [
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch),
        ];
      }
    });
    return {
      phase        : 'pickup',
      pickupTimer  : 0,
      deliveryTimer: 0,
      currentHoop  : 0,
      score        : 0,
      totalScore   : 0,
      missionTimer : 0,
      hoopTimer    : 0,          // tempo desde o último aro (para decaimento)
      def,
      /* distância assinada anterior a cada plano de aro */
      prevDists: def.hoops.map(h => signedDist(drone.pos, h)),
    };
  }

  /* Distância assinada do drone ao plano do aro */
  function signedDist(pos, h) {
    const n = h.normal;
    return (pos[0] - h.pos[0]) * n[0]
         + (pos[1] - h.pos[1]) * n[1]
         + (pos[2] - h.pos[2]) * n[2];
  }

  /* Distância do drone ao centro do aro no plano perpendicular à normal */
  function radialDist(pos, h) {
    // vetor drone->centro
    const dx = pos[0] - h.pos[0];
    const dy = pos[1] - h.pos[1];
    const dz = pos[2] - h.pos[2];
    const n  = h.normal;
    // componente ao longo da normal
    const proj = dx*n[0] + dy*n[1] + dz*n[2];
    // componente perpendicular
    const px = dx - proj*n[0];
    const py = dy - proj*n[1];
    const pz = dz - proj*n[2];
    return Math.sqrt(px*px + py*py + pz*pz);
  }

  let mission = buildMissionState(0);

  const ROAD_HALF_MAIN = 3.0;
  const ROAD_HALF_SEC  = 2.5;
  const SIDEWALK_W_MAIN = 2.2;
  const SIDEWALK_W_SEC  = 1.8;
  const PARK_CX = 24;
  const PARK_CZ = 24;
  const PARK_HW = 9.5;
  const PARK_HZ = 7.5;

  /* ── 7. Layout da cidade ─────────────────────────────────────── */
  /*
   * Cada entrada: [x, z, largura, profundidade, altura, r, g, b]
   * Os prédios são posicionados com a base em Y = 0.
   * As ruas são os espaços em X ∈ [-3,3] e Z ∈ [-3,3].
   */
  const buildings = [
    /* ── Quarteirão NE interno ── */
    [  9,  9, 4, 8,  8, 0.58, 0.56, 0.52],  // concreto quente
    [ 15,  9, 5, 5, 12, 0.26, 0.38, 0.55],  // vidro azul
    [  9, 15, 8, 3,  6, 0.70, 0.64, 0.50],  // pedra bege
    [ 15, 15, 4, 4, 10, 0.54, 0.53, 0.54],  // concreto neutro
    /* ── Quarteirão NO interno ── */
    [ -9,  9, 4, 8, 10, 0.58, 0.40, 0.32],  // tijolo
    [-15,  9, 5, 5,  7, 0.56, 0.56, 0.54],  // concreto
    [ -9, 15, 8, 3,  5, 0.72, 0.66, 0.52],  // pedra clara
    [-15, 15, 4, 4, 14, 0.30, 0.36, 0.52],  // aço azul alto
    /* ── Quarteirão SE interno ── */
    [  9, -9, 4, 8,  9, 0.82, 0.80, 0.78],  // branco moderno
    [ 15, -9, 5, 5,  6, 0.54, 0.53, 0.54],  // concreto
    [  9,-15, 8, 3, 11, 0.28, 0.34, 0.50],  // vidro escuro
    [ 15,-15, 4, 4,  8, 0.62, 0.44, 0.34],  // terracota
    /* ── Quarteirão SO interno ── */
    [ -9, -9, 4, 8,  7, 0.56, 0.56, 0.54],  // concreto
    [-15, -9, 5, 5, 13, 0.26, 0.38, 0.55],  // vidro azul alto
    [ -9,-15, 8, 3,  5, 0.68, 0.62, 0.48],  // pedra bege
    [-15,-15, 4, 4,  9, 0.32, 0.38, 0.52],  // aço azul

    /* ── Quarteirão NE externo ── */
    [ 24, 10, 4, 9, 14, 0.26, 0.38, 0.55],  // vidro
    [ 32, 10, 8, 4,  9, 0.60, 0.58, 0.55],  // concreto
    [ 24, 18, 5, 5,  7, 0.70, 0.64, 0.50],  // pedra
    [ 32, 22, 9, 4, 16, 0.30, 0.36, 0.52],  // aço
    [ 24, 30, 6, 6, 11, 0.58, 0.56, 0.54],  // concreto
    [ 33, 30, 4, 8,  8, 0.62, 0.44, 0.34],  // terracota
    /* ── Quarteirão NO externo ── */
    [-24, 10, 4, 9, 12, 0.30, 0.36, 0.52],  // aço
    [-32, 10, 8, 4, 18, 0.26, 0.38, 0.55],  // vidro alto
    [-24, 20, 5, 5,  7, 0.58, 0.56, 0.54],  // concreto
    [-32, 24, 9, 4, 10, 0.70, 0.64, 0.50],  // pedra
    [-25, 32, 5, 6, 13, 0.82, 0.80, 0.78],  // branco
    [-34, 30, 4, 8,  8, 0.60, 0.42, 0.32],  // tijolo
    /* ── Quarteirão SE externo ── */
    [ 24,-10, 4, 9, 10, 0.58, 0.56, 0.54],  // concreto
    [ 32,-12, 8, 4, 15, 0.28, 0.34, 0.50],  // vidro escuro
    [ 24,-20, 5, 5,  6, 0.70, 0.64, 0.50],  // pedra
    [ 32,-28, 9, 4, 12, 0.82, 0.80, 0.78],  // branco
    [ 24,-33, 6, 6,  9, 0.58, 0.40, 0.32],  // tijolo
    [ 33,-33, 4, 8, 17, 0.26, 0.38, 0.55],  // vidro
    /* ── Quarteirão SO externo ── */
    [-24,-10, 4, 9,  8, 0.60, 0.58, 0.55],  // concreto
    [-32,-12, 8, 4, 14, 0.30, 0.36, 0.52],  // aço
    [-24,-22, 5, 5, 10, 0.64, 0.44, 0.34],  // terracota
    [-32,-26, 9, 4,  7, 0.56, 0.56, 0.54],  // concreto
    [-25,-33, 5, 6, 11, 0.70, 0.64, 0.50],  // pedra
    [-34,-33, 4, 8, 16, 0.28, 0.34, 0.50],  // vidro escuro

    /* ── Torres marcantes espalhadas ── */
    [  0,  47, 7, 7, 22, 0.82, 0.80, 0.78],  // branca
    [ 47,   0, 5, 9, 28, 0.24, 0.34, 0.52],  // vidro escuro alta
    [-47,   0, 9, 5, 18, 0.60, 0.58, 0.55],  // concreto laje
    [  0, -47, 6, 6, 20, 0.30, 0.36, 0.52],  // aço
    [ 47,  47, 5, 5, 15, 0.70, 0.64, 0.50],  // pedra
    [-47,  47, 8, 4, 12, 0.58, 0.40, 0.32],  // tijolo laje
    [ 47, -47, 4, 8, 24, 0.26, 0.38, 0.55],  // vidro laje alto
    [-47, -47, 5, 5, 19, 0.82, 0.80, 0.78],  // branca
    /* Mega-torre central */
    [  0,   0, 8, 8, 35, 0.20, 0.26, 0.40],  // vidro muito escuro

    /* ── Anel externo NE ── */
    [ 58,  55, 5, 9, 16, 0.60, 0.58, 0.55],
    [ 68,  55, 8, 4, 12, 0.26, 0.38, 0.55],
    [ 58,  65, 5, 5, 20, 0.28, 0.34, 0.50],
    [ 72,  65, 4, 4,  9, 0.70, 0.64, 0.50],
    [ 63,  72, 6, 5, 14, 0.82, 0.80, 0.78],
    /* ── Anel externo NO ── */
    [-58,  55, 5, 9, 18, 0.30, 0.36, 0.52],
    [-68,  55, 8, 4, 11, 0.58, 0.40, 0.32],
    [-58,  65, 5, 5, 22, 0.24, 0.34, 0.52],
    [-72,  65, 4, 4, 10, 0.70, 0.64, 0.50],
    [-63,  72, 6, 5, 15, 0.60, 0.58, 0.55],
    /* ── Anel externo SE ── */
    [ 58, -55, 5, 9, 14, 0.58, 0.56, 0.54],
    [ 68, -55, 8, 4, 19, 0.26, 0.38, 0.55],
    [ 58, -65, 5, 5, 10, 0.70, 0.64, 0.50],
    [ 72, -65, 4, 4, 16, 0.30, 0.36, 0.52],
    [ 63, -72, 6, 5, 13, 0.82, 0.80, 0.78],
    /* ── Anel externo SO ── */
    [-58, -55, 5, 9, 17, 0.60, 0.58, 0.55],
    [-68, -55, 8, 4, 10, 0.58, 0.40, 0.32],
    [-58, -65, 5, 5, 21, 0.28, 0.34, 0.50],
    [-72, -65, 4, 4,  8, 0.70, 0.64, 0.50],
    [-63, -72, 6, 5, 12, 0.82, 0.80, 0.78],
    /* ── Torres de borda ── */
    [  0,  72, 6, 6, 18, 0.30, 0.36, 0.52],
    [  0, -72, 6, 6, 16, 0.60, 0.58, 0.55],
    [ 72,   0, 9, 5, 22, 0.24, 0.34, 0.52],
    [-72,   0, 5, 9, 14, 0.70, 0.64, 0.50],
  ];

  const BUILDING_SCALE_XZ = 1.18;
  const BUILDING_SCALE_Y  = 1.45;
  for (let i = 0; i < buildings.length; i++) {
    buildings[i][2] *= BUILDING_SCALE_XZ;
    buildings[i][3] *= BUILDING_SCALE_XZ;
    buildings[i][4] *= BUILDING_SCALE_Y;
  }

  function addMoreBuildings(count) {
    let seed = 0xD00DFEED;
    function rand() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    const palette = [
      [0.58, 0.56, 0.54], [0.26, 0.38, 0.55], [0.70, 0.64, 0.50],
      [0.30, 0.36, 0.52], [0.82, 0.80, 0.78], [0.58, 0.40, 0.32],
      [0.28, 0.34, 0.50], [0.62, 0.44, 0.34],
    ];

    for (let i = 0; i < count; i++) {
      const w = 3.6 + rand() * 6.6;
      const d = 3.6 + rand() * 6.6;
      const h = 8.0 + rand() * 24.0;
      const c = palette[(rand() * palette.length) | 0];

      // Posição provisória: a redistribuição posterior move para área verde.
      const x = (rand() * 2 - 1) * 118;
      const z = (rand() * 2 - 1) * 118;
      buildings.push([x, z, w, d, h, c[0], c[1], c[2]]);
    }
  }

  addMoreBuildings(74);

  function redistributeBuildingsOnGrass() {
    let seed = 0xA1C3E5;
    function rand() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function intersectsTrafficArea(x, z, w, d) {
      const hx = w * 0.5 + 0.5;
      const hz = d * 0.5 + 0.5;

      const mainBand = ROAD_HALF_MAIN + SIDEWALK_W_MAIN;
      const secBand  = ROAD_HALF_SEC + SIDEWALK_W_SEC;

      if (Math.abs(x) < hx + mainBand) return true;
      if (Math.abs(z) < hz + mainBand) return true;

      if (Math.abs(x - 40) < hx + secBand) return true;
      if (Math.abs(x + 40) < hx + secBand) return true;
      if (Math.abs(z - 40) < hz + secBand) return true;
      if (Math.abs(z + 40) < hz + secBand) return true;

      if (Math.abs(x - PARK_CX) < hx + PARK_HW + 1.2 &&
          Math.abs(z - PARK_CZ) < hz + PARK_HZ + 1.2) return true;

      return false;
    }

    function overlapsPlaced(placed, x, z, w, d) {
      const gap = 1.5;
      for (let i = 0; i < placed.length; i++) {
        const p = placed[i];
        const dx = Math.abs(x - p.x);
        const dz = Math.abs(z - p.z);
        if (dx < (w + p.w) * 0.5 + gap && dz < (d + p.d) * 0.5 + gap) return true;
      }
      return false;
    }

    const placed = [];
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const w = b[2], d = b[3];
      let done = false;

      for (let tries = 0; tries < 180; tries++) {
        const x = (rand() * 2 - 1) * 122;
        const z = (rand() * 2 - 1) * 122;

        if (intersectsTrafficArea(x, z, w, d)) continue;
        if (overlapsPlaced(placed, x, z, w, d)) continue;

        b[0] = x;
        b[1] = z;
        placed.push({ x, z, w, d });
        done = true;
        break;
      }

      if (!done) {
        let x = b[0], z = b[1];
        const mainBand = ROAD_HALF_MAIN + SIDEWALK_W_MAIN;
        const secBand  = ROAD_HALF_SEC + SIDEWALK_W_SEC;
        const hx = w * 0.5 + 0.8;
        const hz = d * 0.5 + 0.8;

        if (Math.abs(x) < hx + mainBand) x = Math.sign(x || 1) * (hx + mainBand);
        if (Math.abs(z) < hz + mainBand) z = Math.sign(z || 1) * (hz + mainBand);
        if (Math.abs(x - 40) < hx + secBand) x = 40 + Math.sign(x - 40 || 1) * (hx + secBand);
        if (Math.abs(x + 40) < hx + secBand) x = -40 + Math.sign(x + 40 || 1) * (hx + secBand);
        if (Math.abs(z - 40) < hz + secBand) z = 40 + Math.sign(z - 40 || 1) * (hz + secBand);
        if (Math.abs(z + 40) < hz + secBand) z = -40 + Math.sign(z + 40 || 1) * (hz + secBand);

        b[0] = Math.max(-122, Math.min(122, x));
        b[1] = Math.max(-122, Math.min(122, z));
        placed.push({ x: b[0], z: b[1], w, d });
      }
    }
  }

  redistributeBuildingsOnGrass();

  function buildTreeInstances() {
    const out = [];
    let seed = 0xC0FFEE;

    function rand() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function isInRoad(x, z) {
      if (Math.abs(z) < 4.2) return true;
      if (Math.abs(x) < 4.2) return true;
      if (Math.abs(z - 40) < 3.6 || Math.abs(z + 40) < 3.6) return true;
      if (Math.abs(x - 40) < 3.6 || Math.abs(x + 40) < 3.6) return true;
      return false;
    }

    function hitsBuilding(x, z) {
      const pad = 1.7;
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        const minX = b[0] - b[2] / 2 - pad;
        const maxX = b[0] + b[2] / 2 + pad;
        const minZ = b[1] - b[3] / 2 - pad;
        const maxZ = b[1] + b[3] / 2 + pad;
        if (x > minX && x < maxX && z > minZ && z < maxZ) return true;
      }
      return false;
    }

    function hitsMissionZones(x, z) {
      for (let mi = 0; mi < MISSION_DEFS.length; mi++) {
        const m = MISSION_DEFS[mi];
        const pdx = x - m.pickup.x;
        const pdz = z - m.pickup.z;
        const ddx = x - m.delivery.x;
        const ddz = z - m.delivery.z;
        if (Math.sqrt(pdx * pdx + pdz * pdz) < m.pickup.r + 1.8) return true;
        if (Math.sqrt(ddx * ddx + ddz * ddz) < m.delivery.r + 1.8) return true;
      }
      return false;
    }

    function hitsPark(x, z) {
      return Math.abs(x - PARK_CX) < PARK_HW + 1.2 &&
             Math.abs(z - PARK_CZ) < PARK_HZ + 1.2;
    }

    for (let tries = 0; tries < 9000 && out.length < 185; tries++) {
      const x = (rand() * 2 - 1) * 125;
      const z = (rand() * 2 - 1) * 125;

      if (isInRoad(x, z)) continue;
      if (hitsBuilding(x, z)) continue;
      if (hitsMissionZones(x, z)) continue;
      if (hitsPark(x, z)) continue;

      let tooClose = false;
      for (let i = 0; i < out.length; i++) {
        const dx = x - out[i].x;
        const dz = z - out[i].z;
        if (dx * dx + dz * dz < 20) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const scale = 0.11 + rand() * 0.13;
      out.push({
        x,
        z,
        scale,
        rotY: rand() * Math.PI * 2,
        tint: 0.90 + rand() * 0.25,
      });
    }

    return out;
  }

  function addTreesNearPark(instances) {
    const ring = [
      [-7.8, -5.4], [0.0, -5.8], [7.8, -5.4],
      [-8.2,  0.0],                 [8.2,  0.0],
      [-7.8,  5.4], [0.0,  5.8], [7.8,  5.4],
      [-3.6, -6.6], [3.6, -6.6], [-3.6, 6.6], [3.6, 6.6],
    ];

    for (let i = 0; i < ring.length; i++) {
      const off = ring[i];
      instances.push({
        x: PARK_CX + off[0],
        z: PARK_CZ + off[1],
        scale: 0.10 + (i % 3) * 0.015,
        rotY: (i * 0.83) % (Math.PI * 2),
        tint: 0.95 + (i % 4) * 0.05,
      });
    }
  }

  const treeInstances = buildTreeInstances();
  addTreesNearPark(treeInstances);

  /* ── 7b. Sistema de colisões (AABB no X/Z + volume em Y) ── */
  const BUILDING_Y_MARGIN = 1.8;
  const TREE_Y_MARGIN = 8.0;

  function intersectsSquareAABB(px, pz, pHalf, ox, oz, oHalfX, oHalfZ) {
    return (
      Math.abs(px - ox) <= (pHalf + oHalfX) &&
      Math.abs(pz - oz) <= (pHalf + oHalfZ)
    );
  }

  function overlapsVertical(py, playerHalfHeight, objectTopY) {
    const pMinY = py - playerHalfHeight;
    const pMaxY = py + playerHalfHeight;
    const oMinY = 0.0;
    const oMaxY = objectTopY;
    return pMaxY >= oMinY && pMinY <= oMaxY;
  }

  function overlapsYRange(py, playerHalfHeight, minY, maxY) {
    const pMinY = py - playerHalfHeight;
    const pMaxY = py + playerHalfHeight;
    return pMaxY >= minY && pMinY <= maxY;
  }

  function intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, cx, cz, halfX, halfZ, minY, maxY) {
    if (!overlapsYRange(py, playerHalfHeight, minY, maxY)) return false;
    return intersectsSquareAABB(px, pz, playerHalf, cx, cz, halfX, halfZ);
  }
  
  function checkBuildingCollision(px, pz, py, playerHalf, playerHalfHeight) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bx = b[0], bz = b[1];
      const bw = b[2] * 0.5, bd = b[3] * 0.5;  // half-width, half-depth
      const bh = b[4];  // altura do prédio

      // Corta cedo quando o jogador está muito acima da estrutura total.
      let topY = bh + BUILDING_Y_MARGIN;
      if (bh >= 12) {
        const setH = bh * 0.36;
        topY = bh + setH;
        if (bh >= 20) {
          topY = bh + setH + setH * 0.50;
        } else {
          topY += 1.4;
        }
      } else if (bh >= 6) {
        topY = bh + 1.65;
      }
      topY += BUILDING_Y_MARGIN;
      if (!overlapsVertical(py, playerHalfHeight, topY)) continue;

      // Corpo principal: base do prédio
      if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, bw, bd, 0.0, bh + BUILDING_Y_MARGIN)) {
        return b;
      }

      // Pódio: mais largo perto da base
      if (bh >= 10) {
        const podH = Math.min(bh * 0.16, 2.8);
        if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, bw + 0.14, bd + 0.14, 0.0, podH + BUILDING_Y_MARGIN)) {
          return b;
        }
      }

      // Estrutura superior afunilada (recuos), espelhando drawBuildings
      if (bh >= 12) {
        const setH = bh * 0.36;
        const sw = bw * 0.76;
        const sd = bd * 0.76;
        const setMinY = bh;
        const setMaxY = bh + setH;
        if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, sw, sd, setMinY, setMaxY + BUILDING_Y_MARGIN)) {
          return b;
        }

        if (bh >= 20) {
          const s2H = setH * 0.50;
          const s2MinY = setMaxY;
          const s2MaxY = setMaxY + s2H;
          if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, sw * 0.70, sd * 0.70, s2MinY, s2MaxY + BUILDING_Y_MARGIN)) {
            return b;
          }
        } else {
          const rtH = 1.4;
          const rtMinY = setMaxY;
          const rtMaxY = setMaxY + rtH;
          if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, sw * 0.52, sd * 0.52, rtMinY, rtMaxY + BUILDING_Y_MARGIN)) {
            return b;
          }
        }
      } else if (bh >= 6) {
        // Prédios médios: platibanda + caixa d'água
        if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, bw + 0.07, bd + 0.07, bh + 0.01, bh + 0.47 + BUILDING_Y_MARGIN)) {
          return b;
        }
        if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx + bw * 0.20, bz - bd * 0.18, bw * 0.14, bd * 0.14, bh + 0.35, bh + 1.65 + BUILDING_Y_MARGIN)) {
          return b;
        }
      }
    }
    return null;
  }

  function checkTreeCollision(px, pz, py, playerHalf, playerHalfHeight) {
    for (let i = 0; i < treeInstances.length; i++) {
      const t = treeInstances[i];
      const treeHalf = t.scale * 0.8;  // metade do quadrado horizontal da árvore
      const treeHeight = t.scale * 11.0;  // Altura aproximada da árvore escalada

      if (!overlapsVertical(py, playerHalfHeight, treeHeight + TREE_Y_MARGIN)) continue;

      if (intersectsSquareAABB(px, pz, playerHalf, t.x, t.z, treeHalf, treeHalf)) {
        return t;
      }
    }
    return null;
  }

  function hasWorldCollision(px, pz, py, playerHalf, playerHalfHeight) {
    return (
      checkBuildingCollision(px, pz, py, playerHalf, playerHalfHeight) ||
      checkTreeCollision(px, pz, py, playerHalf, playerHalfHeight)
    );
  }

  function resolveCollision(posArray, oldPos, playerHalf, playerHalfHeight) {
    // Resolve por eixo para evitar travada e melhorar deslizamento em paredes.
    const py = posArray[1];
    const targetX = posArray[0];
    const targetZ = posArray[2];
    let hitX = false;
    let hitZ = false;

    if (hasWorldCollision(targetX, oldPos[2], py, playerHalf, playerHalfHeight)) {
      posArray[0] = oldPos[0];
      hitX = true;
    }

    if (hasWorldCollision(posArray[0], targetZ, py, playerHalf, playerHalfHeight)) {
      posArray[2] = oldPos[2];
      hitZ = true;
    }

    return { hitX: hitX, hitZ: hitZ, hitAny: hitX || hitZ };
  }

  function buildCityProps() {
    const props = [];
    const mainSide = ROAD_HALF_MAIN + SIDEWALK_W_MAIN * 0.52;
    const secSide  = ROAD_HALF_SEC + SIDEWALK_W_SEC * 0.52;

    function pushLamp(x, z, rotY) {
      props.push({ type: 'lamp', x, z, rotY });
    }
    function pushHydrant(x, z) {
      props.push({ type: 'hydrant', x, z, rotY: 0 });
    }
    function pushUtility(x, z, rotY, sx, sz) {
      props.push({ type: 'utility', x, z, rotY, sx, sz });
    }

    // Postes nas calçadas das vias centrais.
    for (let k = -120; k <= 120; k += 24) {
      if (Math.abs(k) < 10) continue;
      if (Math.abs(k - PARK_CX) < PARK_HW + 3.0) continue;
      pushLamp(k,  mainSide, Math.PI * 0.5);
      pushLamp(k, -mainSide, -Math.PI * 0.5);
      pushLamp( mainSide, k, Math.PI);
      pushLamp(-mainSide, k, 0.0);
    }

    // Postes em vias secundárias (x/z=+/-40).
    for (let k = -120; k <= 120; k += 30) {
      if (Math.abs(k) < 8) continue;
      pushLamp(k,  40 + secSide, Math.PI * 0.5);
      pushLamp(k,  40 - secSide, -Math.PI * 0.5);
      pushLamp(k, -40 + secSide, Math.PI * 0.5);
      pushLamp(k, -40 - secSide, -Math.PI * 0.5);

      pushLamp( 40 + secSide, k, Math.PI);
      pushLamp( 40 - secSide, k, 0.0);
      pushLamp(-40 + secSide, k, Math.PI);
      pushLamp(-40 - secSide, k, 0.0);
    }

    // Hidrantes em cantos de cruzamentos e pontos de quadra.
    const hydrants = [
      [  8,  8], [ -8,  8], [  8, -8], [ -8, -8],
      [ 32,  8], [ 48,  8], [ 32, -8], [ 48, -8],
      [-32,  8], [-48,  8], [-32, -8], [-48, -8],
      [  8, 32], [ -8, 32], [  8, 48], [ -8, 48],
      [  8,-32], [ -8,-32], [  8,-48], [ -8,-48],
    ];
    for (let i = 0; i < hydrants.length; i++) pushHydrant(hydrants[i][0], hydrants[i][1]);

    // Estruturas utilitárias (caixas elétricas / quiosques técnicos).
    pushUtility( 54,  18, 0.0, 2.4, 1.6);
    pushUtility( 54, -18, 0.0, 2.2, 1.5);
    pushUtility(-54,  18, 0.0, 2.4, 1.6);
    pushUtility(-54, -18, 0.0, 2.2, 1.5);
    pushUtility( 18,  54, Math.PI * 0.5, 2.5, 1.7);
    pushUtility(-18,  54, Math.PI * 0.5, 2.3, 1.5);
    pushUtility( 18, -54, Math.PI * 0.5, 2.5, 1.7);
    pushUtility(-18, -54, Math.PI * 0.5, 2.3, 1.5);

    return props;
  }

  const cityProps = buildCityProps();

  // LOD simples por distância para aliviar draw calls/geometria por frame.
  const BUILDING_SIMPLIFY_DIST2 = 95 * 95;
  const BUILDING_CULL_DIST2     = 170 * 170;
  const WINDOW_LIGHT_CULL_DIST2 = 115 * 115;
  const TREE_FULL_DIST2         = 80 * 80;
  const TREE_HALF_DIST2         = 130 * 130;
  const TREE_CULL_DIST2         = 180 * 180;
  const PROP_CULL_DIST2         = 155 * 155;
  const PROP_SIMPLIFY_DIST2     = 95 * 95;
  const PROP_SPARSIFY_DIST2     = 120 * 120;

  /* ── Dados de janelas pré-computados por prédio ─────────────────
   * Cada janela: { px, py, pz, sx, sy, sz, warm }
   *   warm 0=quente · 1=neutro · 2=frio · 3=beacon
   * Janelas muito finas (0.018 de espessura) encostadas na face externa
   * do prédio – sem risco de vazar pelo lado oposto.
   * Máximo 3 colunas por fachada.
   * ──────────────────────────────────────────────────────────────── */
  const buildingWindowData = (function () {
    /* cx,cz = centro do bloco, fw,fd = largura/profundidade, yBase = Y da base,
       blockH = altura do bloco, wtype = tipo de luz */
    function addFaceWindows(wins, cx, cz, fw, fd, yBase, blockH, wtype) {
      const rows = Math.min(Math.max(1, Math.floor(blockH / 4.5)), 5);
      const ncX  = Math.min(2, Math.max(1, Math.floor(fw / 2.8)));  // faces ±Z
      const ncZ  = Math.min(2, Math.max(1, Math.floor(fd / 2.8)));  // faces ±X
      const T    = 0.018;  // espessura da janela
      for (let row = 0; row < rows; row++) {
        const wy = yBase + 1.2 + (row + 0.5) * ((blockH - 1.2) / rows);
        /* Faces ±X – janelas ao longo de Z */
        for (let col = 0; col < ncZ; col++) {
          const t   = ncZ > 1 ? col / (ncZ - 1) : 0.5;
          const wz  = cz + (t - 0.5) * fd * 0.66;
          const wsz = Math.min(fd * 0.55 / ncZ, 1.20);
          const off = fw / 2 + T;   // centro a T inteiros fora da face – sem Z-fight
          wins.push({ px: cx + off, py: wy, pz: wz, sx: T, sy: 0.80, sz: wsz, warm: wtype, nx:  1, nz: 0 });
          wins.push({ px: cx - off, py: wy, pz: wz, sx: T, sy: 0.80, sz: wsz, warm: wtype, nx: -1, nz: 0 });
        }
        /* Faces ±Z – janelas ao longo de X */
        for (let col = 0; col < ncX; col++) {
          const t   = ncX > 1 ? col / (ncX - 1) : 0.5;
          const wx  = cx + (t - 0.5) * fw * 0.66;
          const wsx = Math.min(fw * 0.55 / ncX, 1.20);
          const off = fd / 2 + T;
          wins.push({ px: wx, py: wy, pz: cz + off, sx: wsx, sy: 0.80, sz: T, warm: wtype, nx: 0, nz:  1 });
          wins.push({ px: wx, py: wy, pz: cz - off, sx: wsx, sy: 0.80, sz: T, warm: wtype, nx: 0, nz: -1 });
        }
      }
    }

    return buildings.map(function (b, bi) {
      const bx = b[0], bz = b[1], bw = b[2], bd = b[3], bh = b[4];
      if (bh < 5) return [];
      const warm = (bi * 17 + 3) % 3;
      const wins = [];

      /* Corpo principal */
      addFaceWindows(wins, bx, bz, bw, bd, 0, bh, warm);

      if (bh >= 12) {
        /* Primeiro recuo */
        const setH = bh * 0.36;
        const sw   = bw * 0.76, sd = bd * 0.76;
        addFaceWindows(wins, bx, bz, sw, sd, bh, setH, warm);

        if (bh >= 20) {
          /* Segundo recuo */
          const s2H = setH * 0.50;
          const s2Y = bh + setH;
          const sw2 = sw * 0.70, sd2 = sd * 0.70;
          addFaceWindows(wins, bx, bz, sw2, sd2, s2Y, s2H, warm);

          /* Beacon no topo da antena */
          const beaconY = bh * 1.60 + 2.94;
          wins.push({ px: bx, py: beaconY, pz: bz, sx: 0.26, sy: 0.26, sz: 0.26, warm: 3, nx: 0, nz: 0 });
        }
      }
      return wins;
    });
  })();

  /* ── 8. Fonte de luz – ciclo dia/noite ────────────────────────── */

  const LIGHT_R   = 120;
  let   timeOfDay = 0.38;        // 0=meia-noite · 0.25=nascer · 0.5=meio-dia
  const DAY_SPEED = 1 / 480;    // ciclo completo em ~8 min reais

  /* ── 9. HUD ─────────────────────────────────────────────────── */

  const hudPos   = document.getElementById('hud-pos');
  const hudPause = document.getElementById('hud-pause');

  /* Slider de sensibilidade no menu de pausa */
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

  /* Clique no fundo do overlay (não em filhos) → despausar */
  hudPause.addEventListener('click', e => {
    if (e.target === hudPause) setPaused(false);
  });

  const mPhaseEl  = document.getElementById('m-phase');
  const mHoopsEl  = document.getElementById('m-hoops');
  const mBarWrap  = document.getElementById('m-bar-wrap');
  const mBarFill  = document.getElementById('m-bar-fill');
  const mScoreEl  = document.getElementById('m-score');
  const mTimerEl  = document.getElementById('m-timer');
  const mScoreRow = document.getElementById('m-score-row');

  /* Começa pausado (aguarda o primeiro clique) */
  paused = true;
  hudPause.style.display = 'flex';

  /* ── 10. Helper de desenho ──────────────────────────────────── */
  /*
   * Atualiza uModel, uNormalMat e uColor, depois emite o draw call.
   * modelMat deve ser preenchido ANTES de chamar drawBox().
   */
  function drawBox(r, g, b) {
    gl.uniformMatrix4fv(loc.uModel, false, modelMat);
    mat3.normalFromMat4(normMat3, modelMat);     // normal matrix correta
    gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
    gl.uniform3f(loc.uColor, r, g, b);
    gl.drawElements(gl.TRIANGLES, IDX_COUNT, gl.UNSIGNED_SHORT, 0);
  }

  function drawDisc(r, g, b, alpha) {
    gl.uniform1f(loc.uAlpha, alpha !== undefined ? alpha : 1.0);
    gl.uniformMatrix4fv(loc.uModel, false, modelMat);
    mat3.normalFromMat4(normMat3, modelMat);
    gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
    gl.uniform3f(loc.uColor, r, g, b);
    gl.drawArrays(gl.TRIANGLES, 0, DISC_COUNT);
  }

  function drawTorus(r, g, b) {
    gl.uniformMatrix4fv(loc.uModel, false, modelMat);
    mat3.normalFromMat4(normMat3, modelMat);
    gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
    gl.uniform3f(loc.uColor, r, g, b);
    gl.drawElements(gl.TRIANGLES, TOR_IDX_COUNT, gl.UNSIGNED_SHORT, 0);
  }

  /* ── 11. Loop principal ─────────────────────────────────────── */

  let lastT = 0;
  let frameTime = 0; // segundos acumulados (para animações)

  function frame(now) {
    /* dt em segundos, limitado a 50 ms para não "voar" após pausas */
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    frameTime += dt;

    /* ── Avança ciclo dia/noite ──────────────────────────────── */
    if (!paused) timeOfDay = (timeOfDay + DAY_SPEED * dt) % 1.0;
    /* Sincroniza slider de hora (visível também no menu de pausa) */
    if (document.activeElement !== timeSlider)
      timeSlider.value = Math.round(timeOfDay * 1000);
    const _th = Math.floor(timeOfDay * 24);
    const _tm = Math.floor((timeOfDay * 24 * 60) % 60);
    timeValue.textContent = String(_th).padStart(2, '0') + ':' + String(_tm).padStart(2, '0');

    /* ── Atualiza drone ───────────────────────────────────────── */
    /* Pausa: congela tudo, mas continua renderizando */
    if (paused) {
      mouseDX = 0;
      requestAnimationFrame(frame);
      return;
    }
    /* Yaw + Pitch pelo mouse ────────────────────────────────────── */
    if (mouseLocked) {
      drone.yaw      -= mouseDX * drone.SENSITIVITY;
      drone.camPitch += mouseDY * drone.SENSITIVITY;
      /* Clamp: câmera não passa do zênite nem desce abaixo do drone */
      drone.camPitch  = Math.max(-0.08, Math.min(1.45, drone.camPitch));
    }
    mouseDX = 0;
    mouseDY = 0;

    /* Direção "para frente" e "para direita" do drone ─────────── */
    fwdVec[0] = -Math.sin(drone.yaw);
    fwdVec[1] =  0;
    fwdVec[2] = -Math.cos(drone.yaw);
    const rightX =  Math.cos(drone.yaw);
    const rightZ = -Math.sin(drone.yaw);

    const movW = Input.isDown('KeyW');
    const movS = Input.isDown('KeyS');
    const movA = Input.isDown('KeyA');
    const movD = Input.isDown('KeyD');
    const movUp   = Input.isDown('Space');
    const movDown = Input.isDown('ShiftLeft') || Input.isDown('ShiftRight');

    /* ── Acumula força de impulso com base nas teclas ────────────── */
    let ax = 0, az = 0, ay = 0;
    if (movW) { ax += fwdVec[0] * drone.ACCEL; az += fwdVec[2] * drone.ACCEL; }
    if (movS) { ax -= fwdVec[0] * drone.ACCEL; az -= fwdVec[2] * drone.ACCEL; }
    if (movA) { ax -= rightX * drone.ACCEL; az -= rightZ * drone.ACCEL; }
    if (movD) { ax += rightX * drone.ACCEL; az += rightZ * drone.ACCEL; }
    if (movUp)   ay =  drone.ACCEL;
    if (movDown) ay = -drone.ACCEL;

    /* Gravidade — reduzida quando o drone tem velocidade horizontal */
    const hspd0 = Math.sqrt(drone.vel[0] ** 2 + drone.vel[2] ** 2);
    const gravScale = 1.0 - Math.min(hspd0 / drone.SPEED, 1.0) * 0.75;
    ay -= drone.GRAVITY * gravScale;

    /* ── Integra velocidade: v += (a - drag*v) * dt ─────────────── */
    drone.vel[0] += (ax - drone.DRAG  * drone.vel[0]) * dt;
    drone.vel[2] += (az - drone.DRAG  * drone.vel[2]) * dt;
    drone.vel[1] += (ay - drone.VDRAG * drone.vel[1]) * dt;

    /* ── Dissipa o boost temporário independentemente ────────────── */
    drone.boostVel[0] -= drone.boostVel[0] * drone.BOOST_DRAG * dt;
    drone.boostVel[1] -= drone.boostVel[1] * drone.BOOST_DRAG * dt;
    drone.boostVel[2] -= drone.boostVel[2] * drone.BOOST_DRAG * dt;

    /* Limita a velocidade máxima horizontal e vertical */
    const hspd = Math.sqrt(drone.vel[0] ** 2 + drone.vel[2] ** 2);
    if (hspd > drone.SPEED) {
      drone.vel[0] = drone.vel[0] / hspd * drone.SPEED;
      drone.vel[2] = drone.vel[2] / hspd * drone.SPEED;
    }
    drone.vel[1] = Math.max(-drone.VSPEED, Math.min(drone.VSPEED, drone.vel[1]));

    /* ── Aplica velocidade à posição ──────────────────────────── */
    const oldDronePos = [drone.pos[0], drone.pos[1], drone.pos[2]];
    drone.pos[0] += (drone.vel[0] + drone.boostVel[0]) * dt;
    drone.pos[1] += (drone.vel[1] + drone.boostVel[1]) * dt;
    drone.pos[2] += (drone.vel[2] + drone.boostVel[2]) * dt;

    if (drone.pos[1] < 0.3) { drone.pos[1] = 0.3; drone.vel[1] = 0; }
    if (drone.pos[1] > 150)  { drone.pos[1] = 150; drone.vel[1] = 0; drone.boostVel[1] = 0; }
    
    /* ── Verifica colisões com prédios e árvores ─────────────── */
    const PLAYER_HALF_SIZE = 1.3;
    const PLAYER_HALF_HEIGHT = 1.7;
    const collision = resolveCollision(drone.pos, oldDronePos, PLAYER_HALF_SIZE, PLAYER_HALF_HEIGHT);
    if (collision.hitX) drone.vel[0] = 0;
    if (collision.hitZ) drone.vel[2] = 0;
    
    updateMission(dt);
    /* ── Tilt visual suavizado (baseado na velocidade real) ─────── */
    // Projeta a velocidade horizontal nos eixos local do drone
    const vFwd   =  drone.vel[0] * fwdVec[0] + drone.vel[2] * fwdVec[2];
    const vRight =  drone.vel[0] * rightX     + drone.vel[2] * rightZ;
    const tpTarget = (vFwd  / drone.SPEED) *  drone.MAX_TILT;
    const trTarget = (vRight / drone.SPEED) * -drone.MAX_TILT;
    drone.tiltPitch += (tpTarget - drone.tiltPitch) * drone.TILT_SPEED * dt;
    drone.tiltRoll  += (trTarget - drone.tiltRoll)  * drone.TILT_SPEED * dt;

    /* ── Nudge vertical da câmera baseado em vel Y ───────────────── */
    /* Subindo: câmera desce (pitch aumenta) pra "sentir" a subida     */
    /* Descendo: câmera sobe (pitch diminui) pra "sentir" a descida    */
    const nudgeTarget = -(drone.vel[1] / drone.VSPEED) * 0.18;
    drone.camPitchNudge += (nudgeTarget - drone.camPitchNudge) * 6 * dt;

    /* ── Câmera orbital (yaw + pitch) ─────────────────────────── */
    const hDist = Math.cos(drone.camPitch) * drone.CAM_DIST;
    const effectivePitch = drone.camPitch + drone.camPitchNudge;
    camPos[0] = drone.pos[0] + Math.sin(drone.yaw) * hDist;
    camPos[1] = drone.pos[1] + Math.sin(effectivePitch) * drone.CAM_DIST;
    camPos[2] = drone.pos[2] + Math.cos(drone.yaw) * hDist;

    mat4.lookAt(viewMat, camPos, drone.pos, [0, 1, 0]);
    mat4.perspective(projMat, Math.PI / 3,           // 60° FOV
                     canvas.width / canvas.height,
                     0.1, 600);

    /* ── Atualiza HUD ─────────────────────────────────────────── */
    if (hudPos)
      hudPos.textContent =
        `X: ${drone.pos[0].toFixed(1)} \u00a0 ` +
        `Y: ${drone.pos[1].toFixed(1)} \u00a0 ` +
        `Z: ${drone.pos[2].toFixed(1)}`;

    /* ── Sol, céu e iluminação dinâmica ─────────────────────── */
    const _sunAngle  = (timeOfDay - 0.25) * Math.PI * 2;
    const _sunHeight = Math.sin(_sunAngle);
    const _sunX = Math.cos(_sunAngle) * LIGHT_R;
    const _sunY = _sunHeight          * LIGHT_R;
    const _sunZ = Math.sin(_sunAngle * 0.4 + 1.0) * 35;

    /* Posição da lua (órbita oposta) */
    const _moonAngle = (_sunAngle + Math.PI * 1.04);
    const _moonX = Math.cos(_moonAngle) * LIGHT_R * 0.92;
    const _moonY = Math.sin(_moonAngle) * LIGHT_R * 0.82;
    const _moonZ = Math.sin(_moonAngle * 0.35 + 0.8) * 40;

    /* Blend da fonte de luz: dia=sol, noite=lua
       Quando o sol está abaixo do horizonte, a lua assume a iluminação */
    const _nightBlend = Math.max(0, Math.min(1, -_sunHeight * 3.0 + 0.25));
    const _lightBlend = _nightBlend;  // 0=só sol · 1=só lua
    lightPos[0] = _sunX * (1 - _lightBlend) + _moonX * _lightBlend;
    lightPos[1] = _sunY * (1 - _lightBlend) + _moonY * _lightBlend;
    lightPos[2] = _sunZ * (1 - _lightBlend) + _moonZ * _lightBlend;

    /* Luz da lua é mais fraca que a do sol: atenua a difusa à noite
       via ambient (moonlight dá mais ambient do que difusa direcional) */
    const _ambientVal = 0.12 + Math.max(0, _sunHeight) * 0.22
                             + _nightBlend * 0.06;   // leve brilho lunar
    const _sky        = skyColor(timeOfDay);
    const _fogNear    = 48.0 - _nightBlend * 6.0;
    const _fogFar     = 170.0 - _nightBlend * 12.0;

    /* ── Estado WebGL ─────────────────────────────────────────── */
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(_sky[0], _sky[1], _sky[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    /* Uniforms que não mudam durante o frame */
    gl.uniformMatrix4fv(loc.uView, false, viewMat);
    gl.uniformMatrix4fv(loc.uProj, false, projMat);
    gl.uniform3fv(loc.uLightPos, lightPos);
    gl.uniform3fv(loc.uEyePos,   camPos);
    /* Intensidade da fonte: sol=1.0, lua=~0.15 (noite muito mais escura) */
    const _lightIntensity = 1.0 - _nightBlend * 0.85;
    gl.uniform1f(loc.uAmbient,        _ambientVal);
    gl.uniform1f(loc.uLightIntensity, _lightIntensity);
    gl.uniform3f(loc.uFogColor,
      _sky[0] * 0.82 + 0.06,
      _sky[1] * 0.82 + 0.06,
      _sky[2] * 0.84 + 0.06
    );
    gl.uniform1f(loc.uFogNear, _fogNear);
    gl.uniform1f(loc.uFogFar,  _fogFar);
    gl.uniform3f(loc.uEmissive,       0.0, 0.0, 0.0);
    gl.uniform1f(loc.uAlpha,          1.0);
    gl.uniform1f(loc.uSpecular,       1.0);  // default; sobrescrito por objeto

    /* Vincula os buffers da única malha (cubo) */
    bindMesh();

    /* ── Sol e Lua ───────────────────────────────────────────── */
    drawSkyObjects(_sunHeight, _nightBlend, _sunX, _sunY, _sunZ);
    bindMesh(); // restaura após drawSkyObjects

    /* ── Chão ─────────────────────────────────────────────────── */
    /* Glow urbano noturno: simula reflexo de luzes da cidade no solo */
    const _gg = _nightBlend * 0.06;
    gl.uniform3f(loc.uEmissive, _gg * 0.50, _gg * 0.38, _gg * 0.10);
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [0, -0.15, 0]);
    mat4.scale(modelMat, modelMat, [300, 0.3, 300]);
    drawBox(0.28, 0.58, 0.22);   // verde grama
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);

    /* ── Ruas (faixas escuras ligeiramente elevadas) ───────────── */
    // Rua Leste–Oeste (eixo X)
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [0, 0.02, 0]);
    mat4.scale(modelMat, modelMat, [300, 0.04, 6]);
    drawBox(0.22, 0.22, 0.22);

    // Calçadas da via Leste–Oeste central
    for (const zSide of [ROAD_HALF_MAIN + SIDEWALK_W_MAIN * 0.5, -ROAD_HALF_MAIN - SIDEWALK_W_MAIN * 0.5]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [0, 0.028, zSide]);
      mat4.scale(modelMat, modelMat, [300, 0.05, SIDEWALK_W_MAIN]);
      drawBox(0.58, 0.58, 0.56);
    }

    // Rua Norte–Sul (eixo Z)
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [0, 0.02, 0]);
    mat4.scale(modelMat, modelMat, [6, 0.04, 300]);
    drawBox(0.22, 0.22, 0.22);

    // Calçadas da via Norte–Sul central
    for (const xSide of [ROAD_HALF_MAIN + SIDEWALK_W_MAIN * 0.5, -ROAD_HALF_MAIN - SIDEWALK_W_MAIN * 0.5]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [xSide, 0.028, 0]);
      mat4.scale(modelMat, modelMat, [SIDEWALK_W_MAIN, 0.05, 300]);
      drawBox(0.58, 0.58, 0.56);
    }

    // Ruas secundárias (z=±40 e x=±40)
    for (const zOff of [-40, 40]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [0, 0.02, zOff]);
      mat4.scale(modelMat, modelMat, [300, 0.04, 5]);
      drawBox(0.22, 0.22, 0.22);

      for (const side of [1, -1]) {
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [0, 0.028, zOff + side * (ROAD_HALF_SEC + SIDEWALK_W_SEC * 0.5)]);
        mat4.scale(modelMat, modelMat, [300, 0.05, SIDEWALK_W_SEC]);
        drawBox(0.56, 0.56, 0.54);
      }
    }
    for (const xOff of [-40, 40]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [xOff, 0.02, 0]);
      mat4.scale(modelMat, modelMat, [5, 0.04, 300]);
      drawBox(0.22, 0.22, 0.22);

      for (const side of [1, -1]) {
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [xOff + side * (ROAD_HALF_SEC + SIDEWALK_W_SEC * 0.5), 0.028, 0]);
        mat4.scale(modelMat, modelMat, [SIDEWALK_W_SEC, 0.05, 300]);
        drawBox(0.56, 0.56, 0.54);
      }
    }

    /* ── Pracinha (água + bancos) ─────────────────────────────── */
    drawPark(_nightBlend);

    /* ── Mobiliário urbano (postes/hidrantes/estruturas) ─────── */
    drawCityProps(_nightBlend);

    /* ── Prédios ──────────────────────────────────────────────── */
    gl.uniform1f(loc.uSpecular, 0.06);   // prédios: quase matte
    drawBuildings(_nightBlend);
    drawBuildingLights(_nightBlend);

    /* ── Árvores (OBJ) ─────────────────────────────────────────── */
    drawTrees(_nightBlend);
    bindMesh();

    gl.uniform1f(loc.uSpecular, 1.0);    // restaura

    /* ── Drone ────────────────────────────────────────────────── */
    drawDrone();
    drawMission();

    requestAnimationFrame(frame);
  }

  /* ── 11b. Interpolação da cor do céu ───────────────────────── */

  function skyColor(t) {
    /* keyframes: [timeOfDay, r, g, b]
     * Evita preto puro e transições abruptas.
     * A noite é um azul escuro, nunca completamente preto. */
    const keys = [
      [0.00, 0.05, 0.07, 0.22],  // meia-noite – azul noturno
      [0.20, 0.08, 0.11, 0.28],  // antes da aurora – azul profundo
      [0.24, 0.50, 0.28, 0.18],  // aurora – laranja quente
      [0.28, 0.72, 0.60, 0.38],  // nascer do sol – dourado
      [0.38, 0.52, 0.80, 0.92],  // manhã – azul claro
      [0.50, 0.38, 0.72, 0.98],  // meio-dia – céu vivo
      [0.62, 0.52, 0.80, 0.92],  // tarde
      [0.74, 0.82, 0.50, 0.18],  // pôr-do-sol – laranja/vermelho
      [0.82, 0.45, 0.22, 0.26],  // crepúsculo – roxo-avermelhado
      [0.90, 0.14, 0.12, 0.32],  // início da noite – azul-arroxeado
      [1.00, 0.05, 0.07, 0.22],  // meia-noite
    ];
    for (let i = 0; i < keys.length - 1; i++) {
      const k0 = keys[i], k1 = keys[i + 1];
      if (t >= k0[0] && t <= k1[0]) {
        const f = (t - k0[0]) / (k1[0] - k0[0]);
        return [k0[1]+(k1[1]-k0[1])*f, k0[2]+(k1[2]-k0[2])*f, k0[3]+(k1[3]-k0[3])*f];
      }
    }
    return [0.38, 0.72, 0.98];
  }

  /* ── 11b2. Sol e Lua ────────────────────────────────────────── */

  function drawSkyObjects(sunHeight, nightBlend, sunX, sunY, sunZ) {
    gl.disable(gl.CULL_FACE);
    gl.uniform1f(loc.uSpecular, 0.0);  // astros: sem especular

    /* ─ Sol ────────────────────────────────────────────────── */
    if (sunHeight > -0.10) {
      const fade = Math.min(1.0, (sunHeight + 0.10) / 0.14);
      const t  = Math.max(0.0, Math.min(1.0, sunHeight * 3.0));
      const sr = 1.0;
      const sg = 0.55 + t * 0.45;
      const sb = 0.15 + t * 0.85;
      gl.uniform3f(loc.uEmissive, sr * fade, sg * fade, sb * fade);
      gl.uniform3f(loc.uColor, sr, sg, sb);
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [sunX, sunY, sunZ]);
      mat4.scale(modelMat, modelMat, [5.5, 5.5, 5.5]);
      gl.uniformMatrix4fv(loc.uModel, false, modelMat);
      mat3.normalFromMat4(normMat3, modelMat);
      gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
      gl.drawElements(gl.TRIANGLES, IDX_COUNT, gl.UNSIGNED_SHORT, 0);
    }

    /* ─ Lua ────────────────────────────────────────────────── */
    if (nightBlend > 0.05) {
      const moonAngle = (timeOfDay - 0.25 + 0.52) * Math.PI * 2;
      const mx = Math.cos(moonAngle) * LIGHT_R * 0.92;
      const my = Math.sin(moonAngle) * LIGHT_R * 0.82;
      const mz = Math.sin(moonAngle * 0.35 + 0.8) * 40;
      if (my > 2.0) {
        const mfade = nightBlend * Math.min(1.0, (my - 2.0) / 14.0);
        gl.uniform3f(loc.uEmissive, 0.70 * mfade, 0.74 * mfade, 0.82 * mfade);
        gl.uniform3f(loc.uColor, 0.82, 0.85, 0.90);
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [mx, my, mz]);
        mat4.scale(modelMat, modelMat, [3.8, 3.8, 3.8]);
        gl.uniformMatrix4fv(loc.uModel, false, modelMat);
        mat3.normalFromMat4(normMat3, modelMat);
        gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
        gl.drawElements(gl.TRIANGLES, IDX_COUNT, gl.UNSIGNED_SHORT, 0);
      }
    }

    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    gl.uniform1f(loc.uSpecular, 1.0);   // restaura
    gl.enable(gl.CULL_FACE);
  }

  /* ── 11c. Prédios com detalhes estruturais ──────────────────── */

  function drawBuildings(nightBlend) {
    bindMesh();
    for (let i = 0; i < buildings.length; i++) {
      const b  = buildings[i];
      const bx = b[0], bz = b[1], bw = b[2], bd = b[3], bh = b[4];
      const br = b[5], bg = b[6], bb = b[7];
      const dx = bx - camPos[0];
      const dz = bz - camPos[2];
      const d2 = dx * dx + dz * dz;

      if (d2 > BUILDING_CULL_DIST2) continue;
      const simplified = d2 > BUILDING_SIMPLIFY_DIST2;

      /* ── Corpo principal ── */
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [bx, bh / 2, bz]);
      mat4.scale(modelMat, modelMat, [bw, bh, bd]);
      drawBox(br, bg, bb);

      /* ── Pódio: base alargada e mais escura ── */
      if (!simplified && bh >= 10) {
        const podH = Math.min(bh * 0.16, 2.8);
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [bx, podH / 2, bz]);
        mat4.scale(modelMat, modelMat, [bw + 0.28, podH, bd + 0.28]);
        drawBox(br * 0.76, bg * 0.76, bb * 0.76);
      }

      /* ── Faixas horizontais (spandrels) entre pavimentos ── */
      if (!simplified && bh >= 7) {
        const numBands = Math.min(Math.floor(bh / 3.2) - 1, 7);
        if (numBands > 0) {
          const bandStep = bh / (numBands + 1);
          const lr = Math.min(br * 1.16, 1.0);
          const lg = Math.min(bg * 1.16, 1.0);
          const lb = Math.min(bb * 1.16, 1.0);
          for (let f = 1; f <= numBands; f++) {
            mat4.identity(modelMat);
            mat4.translate(modelMat, modelMat, [bx, f * bandStep, bz]);
            mat4.scale(modelMat, modelMat, [bw + 0.06, 0.22, bd + 0.06]);
            drawBox(lr, lg, lb);
          }
        }
      }

      /* ── Estrutura superior ── */
      if (!simplified && bh >= 12) {
        /* Primeiro recuo */
        const setH = bh * 0.36;
        const setY = bh + setH / 2;
        const sw   = bw * 0.76;
        const sd   = bd * 0.76;
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [bx, setY, bz]);
        mat4.scale(modelMat, modelMat, [sw, setH, sd]);
        drawBox(Math.min(br * 1.08, 1.0), Math.min(bg * 1.08, 1.0), Math.min(bb * 1.08, 1.0));

        if (bh >= 20) {
          /* Segundo recuo */
          const s2H = setH * 0.50;
          const s2Y = setY + setH / 2 + s2H / 2;
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [bx, s2Y, bz]);
          mat4.scale(modelMat, modelMat, [sw * 0.70, s2H, sd * 0.70]);
          drawBox(Math.min(br * 1.16, 1.0), Math.min(bg * 1.16, 1.0), Math.min(bb * 1.16, 1.0));

          /* Antena */
          const antBase = s2Y + s2H / 2;
          const antH    = 2.8 + bh * 0.06;
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [bx, antBase + antH / 2, bz]);
          mat4.scale(modelMat, modelMat, [0.14, antH, 0.14]);
          drawBox(0.62, 0.62, 0.66);

          /* Ponta da antena */
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [bx, antBase + antH + 0.14, bz]);
          mat4.scale(modelMat, modelMat, [0.24, 0.24, 0.24]);
          drawBox(0.30, 0.10, 0.10);

        } else {
          /* Bloco de cobertura (médio porte) */
          const rtH = 1.4;
          const rtY = setY + setH / 2 + rtH / 2;
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [bx, rtY, bz]);
          mat4.scale(modelMat, modelMat, [sw * 0.52, rtH, sd * 0.52]);
          drawBox(Math.min(br * 1.22, 1.0), Math.min(bg * 1.22, 1.0), Math.min(bb * 1.22, 1.0));
        }

      } else if (!simplified && bh >= 6) {
        /* Platibanda */
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [bx, bh + 0.24, bz]);
        mat4.scale(modelMat, modelMat, [bw + 0.14, 0.46, bd + 0.14]);
        drawBox(Math.min(br * 1.12, 1.0), Math.min(bg * 1.12, 1.0), Math.min(bb * 1.12, 1.0));

        /* Caixa d'água */
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [bx + bw * 0.20, bh + 1.0, bz - bd * 0.18]);
        mat4.scale(modelMat, modelMat, [bw * 0.28, 1.3, bd * 0.28]);
        drawBox(Math.min(br * 0.90, 1.0), Math.min(bg * 0.90, 1.0), Math.min(bb * 0.90, 1.0));
      }

      /* ── Janelas escuras – polygon offset para nunca sofrer Z-fight com a face ── */
      const wins = buildingWindowData[i];
      if (!simplified && wins) {
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(-2, -4);  // empurra para frente no espaço de depth
        for (let wi = 0; wi < wins.length; wi++) {
          const w = wins[wi];
          if (w.warm === 3) continue;  // beacon tratado separadamente
          /* Se esta janela será iluminada em drawBuildingLights, não desenhar escura */
          if (nightBlend >= 0.04 && ((i * 13 + wi * 7) % 100) <= 62) continue;
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [w.px, w.py, w.pz]);
          mat4.scale(modelMat, modelMat, [w.sx, w.sy, w.sz]);
          drawBox(0.09, 0.11, 0.17);  // vidro escuro azulado
        }
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
    }
  }

  /* ── 11d. Luzes de janelas (noturnas) ───────────────────────── */

  /* Padrão 3 piscadas rápidas depois pausa longa (~4s de ciclo) */
  function beaconBlink(t) {
    const c = t % 4.2;
    if (c < 0.18)                       return 1.0;  // piscada 1
    if (c < 0.45)                       return 0.0;
    if (c > 0.45 && c < 0.63)           return 1.0;  // piscada 2
    if (c < 0.90)                       return 0.0;
    if (c > 0.90 && c < 1.08)           return 1.0;  // piscada 3
    return 0.0;                                       // pausa longa
  }

  function drawBuildingLights(nightBlend) {
    if (nightBlend < 0.04) return;
    bindMesh();
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-2, -4);
    for (let bi = 0; bi < buildingWindowData.length; bi++) {
      const b = buildings[bi];
      if (b) {
        const dx = b[0] - camPos[0];
        const dz = b[1] - camPos[2];
        if (dx * dx + dz * dz > WINDOW_LIGHT_CULL_DIST2) continue;
      }

      const wins = buildingWindowData[bi];
      for (let wi = 0; wi < wins.length; wi++) {
        const w = wins[wi];
        /* ~62 % das janelas ligadas (determinístico); beacon sempre */
        if (w.warm !== 3 && ((bi * 13 + wi * 7) % 100) > 62) continue;

        const em = nightBlend * 0.90;
        let er, eg, eb;
        if (w.warm === 0) {
          er = 1.00 * em; eg = 0.78 * em; eb = 0.26 * em; // quente
        } else if (w.warm === 1) {
          er = 0.95 * em; eg = 0.90 * em; eb = 0.65 * em; // neutro
        } else if (w.warm === 2) {
          er = 0.50 * em; eg = 0.68 * em; eb = 1.00 * em; // frio
        } else {
          /* Beacon: 3 piscadas rápidas + pausa (sempre visível, não só à noite) */
          const blink = beaconBlink(frameTime);
          er = 1.00 * blink; eg = 0.08 * blink; eb = 0.08 * blink;
        }
        gl.uniform3f(loc.uEmissive, er, eg, eb);
        mat4.identity(modelMat);
        /* Posição exata – sem offset pois a janela escura foi omitida (sem Z-fight) */
        mat4.translate(modelMat, modelMat, [w.px, w.py, w.pz]);
        mat4.scale(modelMat, modelMat, [w.sx, w.sy, w.sz]);
        drawBox(0.09, 0.11, 0.17);
      }
    }
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  /* ── 12. Desenho do drone (corpo + cúpula + hélices) ──────── */

  /* Offsets locais das 4 hélices (quadricóptero) */
  const PROP_LOCAL = [
    [ 0.8, 0,  0.8],
    [-0.8, 0,  0.8],
    [ 0.8, 0, -0.8],
    [-0.8, 0, -0.8],
  ];

  /*
   * Matriz base compartilhada por todas as partes do drone.
   * Encode: translação + yaw + tiltPitch (X) + tiltRoll (Z)
   */
  const droneBase = mat4.create();

  function buildDroneBase() {
    mat4.identity(droneBase);
    mat4.translate(droneBase, droneBase, drone.pos);
    mat4.rotateY(droneBase, droneBase,  drone.yaw);
    mat4.rotateX(droneBase, droneBase, -drone.tiltPitch); // W → nariz desce
    mat4.rotateZ(droneBase, droneBase,  drone.tiltRoll);  // D → inclina dir
  }

  function drawDrone() {
    buildDroneBase();

    /* Corpo principal */
    mat4.copy(modelMat, droneBase);
    mat4.scale(modelMat, modelMat, [1.8, 0.25, 1.8]);
    drawBox(0.15, 0.15, 0.80);

    /* Cúpula / cabine – cubo menor sobre o corpo */
    mat4.copy(modelMat, droneBase);
    mat4.translate(modelMat, modelMat, [0, 0.22, 0]);
    mat4.scale(modelMat, modelMat, [0.65, 0.35, 0.65]);
    drawBox(0.20, 0.20, 0.90);

    /* Indicador de nariz (frente) – cubo amarelo */
    mat4.copy(modelMat, droneBase);
    mat4.translate(modelMat, modelMat, [0, 0, -1.0]);
    mat4.scale(modelMat, modelMat, [0.22, 0.18, 0.22]);
    drawBox(1.0, 0.85, 0.0);

    /* Guardas das hélices – cubos vermelhos nos 4 cantos */
    for (let i = 0; i < PROP_LOCAL.length; i++) {
      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, PROP_LOCAL[i]);
      mat4.scale(modelMat, modelMat, [0.38, 0.10, 0.38]);
      drawBox(0.90, 0.15, 0.15);
    }
  }

  function drawTrees(nightBlend) {
    if (!treeMesh || treeInstances.length === 0) return;

    bindOBJMesh(gl, loc, treeMesh);
    gl.uniform1f(loc.uSpecular, 0.08);
    gl.uniform1f(loc.uTreeMode, 1.0);

    for (let i = 0; i < treeInstances.length; i++) {
      const t = treeInstances[i];
      const dx = t.x - camPos[0];
      const dz = t.z - camPos[2];
      const d2 = dx * dx + dz * dz;

      if (d2 > TREE_CULL_DIST2) continue;
      if (d2 > TREE_HALF_DIST2 && (i % 2) !== 0) continue;
      if (d2 > TREE_FULL_DIST2 && d2 <= TREE_HALF_DIST2 && (i % 3) === 1) continue;

      const s = t.scale;
      const e = nightBlend * 0.02;
      const baseY = 0.75 * s;

      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [t.x, baseY, t.z]);
      mat4.rotateY(modelMat, modelMat, t.rotY);
      mat4.scale(modelMat, modelMat, [s, s, s]);

      gl.uniformMatrix4fv(loc.uModel, false, modelMat);
      mat3.normalFromMat4(normMat3, modelMat);
      gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
      gl.uniform1f(loc.uTreeTrunkTop, baseY + 7.6 * s);
      gl.uniform3f(loc.uEmissive, e * 0.20, e * 0.32, e * 0.08);
      gl.uniform3f(loc.uColor, 0.17 * t.tint, 0.45 * t.tint, 0.17 * t.tint);
      drawOBJMesh(gl, treeMesh);
    }

    gl.uniform1f(loc.uTreeMode, 0.0);
    gl.uniform1f(loc.uTreeTrunkTop, 0.0);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    gl.uniform1f(loc.uSpecular, 1.0);
  }

  function drawPark(nightBlend) {
    // Base da praça (piso claro)
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [PARK_CX, 0.03, PARK_CZ]);
    mat4.scale(modelMat, modelMat, [PARK_HW * 2, 0.06, PARK_HZ * 2]);
    drawBox(0.68, 0.68, 0.64);

    // Faixa de grama interna
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [PARK_CX, 0.055, PARK_CZ]);
    mat4.scale(modelMat, modelMat, [PARK_HW * 1.7, 0.03, PARK_HZ * 1.6]);
    drawBox(0.30, 0.52, 0.24);

    // Espelho d'água central
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(loc.uAlpha, 0.78);
    gl.uniform3f(loc.uEmissive,
      0.03 + nightBlend * 0.05,
      0.07 + nightBlend * 0.06,
      0.10 + nightBlend * 0.08
    );
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [PARK_CX, 0.095, PARK_CZ]);
    mat4.scale(modelMat, modelMat, [PARK_HW * 0.9, 0.04, PARK_HZ * 0.55]);
    drawBox(0.22, 0.45, 0.62);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    gl.uniform1f(loc.uAlpha, 1.0);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // Bancos simples (2 de cada lado da água)
    const benches = [
      [PARK_CX - 4.2, PARK_CZ - 2.6, 0.0],
      [PARK_CX - 4.2, PARK_CZ + 2.6, 0.0],
      [PARK_CX + 4.2, PARK_CZ - 2.6, Math.PI],
      [PARK_CX + 4.2, PARK_CZ + 2.6, Math.PI],
    ];

    for (let i = 0; i < benches.length; i++) {
      const b = benches[i];
      const bx = b[0], bz = b[1], by = b[2];

      // assento
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [bx, 0.22, bz]);
      mat4.rotateY(modelMat, modelMat, by);
      mat4.scale(modelMat, modelMat, [1.7, 0.12, 0.42]);
      drawBox(0.43, 0.30, 0.18);

      // encosto
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [bx, 0.47, bz + (by === 0.0 ? -0.18 : 0.18)]);
      mat4.rotateY(modelMat, modelMat, by);
      mat4.scale(modelMat, modelMat, [1.7, 0.34, 0.12]);
      drawBox(0.40, 0.28, 0.16);

      // pés
      for (const lx of [-0.6, 0.6]) {
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [bx + lx, 0.10, bz]);
        mat4.scale(modelMat, modelMat, [0.10, 0.20, 0.10]);
        drawBox(0.24, 0.24, 0.26);
      }
    }

    // Bordas baixas decorativas
    for (const sz of [-1, 1]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [PARK_CX, 0.12, PARK_CZ + sz * (PARK_HZ - 0.35)]);
      mat4.scale(modelMat, modelMat, [PARK_HW * 1.95, 0.18, 0.18]);
      drawBox(0.55, 0.55, 0.52);
    }
    for (const sx of [-1, 1]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [PARK_CX + sx * (PARK_HW - 0.35), 0.12, PARK_CZ]);
      mat4.scale(modelMat, modelMat, [0.18, 0.18, PARK_HZ * 1.95]);
      drawBox(0.55, 0.55, 0.52);
    }
  }

  function drawCityProps(nightBlend) {
    for (let i = 0; i < cityProps.length; i++) {
      const p = cityProps[i];
      const dx = p.x - camPos[0];
      const dz = p.z - camPos[2];
      const d2 = dx * dx + dz * dz;
      if (d2 > PROP_CULL_DIST2) continue;
      if (d2 > PROP_SPARSIFY_DIST2 && (i % 2) !== 0) continue;

      const simplified = d2 > PROP_SIMPLIFY_DIST2;

      if (p.type === 'lamp') {
        // Base
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [p.x, 0.10, p.z]);
        mat4.scale(modelMat, modelMat, [0.26, 0.20, 0.26]);
        drawBox(0.26, 0.26, 0.28);

        // Poste
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [p.x, 2.0, p.z]);
        mat4.scale(modelMat, modelMat, [0.08, 3.8, 0.08]);
        drawBox(0.34, 0.34, 0.36);

        if (!simplified) {
          // Braço
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [p.x, 3.86, p.z]);
          mat4.rotateY(modelMat, modelMat, p.rotY);
          mat4.translate(modelMat, modelMat, [0.38, 0.0, 0.0]);
          mat4.scale(modelMat, modelMat, [0.76, 0.06, 0.06]);
          drawBox(0.36, 0.36, 0.38);
        }

        // Luminária
        const lx = p.x + Math.cos(p.rotY) * 0.78;
        const lz = p.z - Math.sin(p.rotY) * 0.78;
        const le = nightBlend * (simplified ? 0.30 : 0.52);
        gl.uniform3f(loc.uEmissive, le * 1.0, le * 0.84, le * 0.52);
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [lx, 3.72, lz]);
        mat4.scale(modelMat, modelMat, simplified ? [0.12, 0.10, 0.12] : [0.16, 0.12, 0.16]);
        drawBox(0.96, 0.84, 0.52);

        gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
      } else if (p.type === 'hydrant') {
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [p.x, 0.16, p.z]);
        mat4.scale(modelMat, modelMat, [0.20, 0.32, 0.20]);
        drawBox(0.78, 0.08, 0.08);

        if (!simplified) {
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [p.x, 0.42, p.z]);
          mat4.scale(modelMat, modelMat, [0.12, 0.20, 0.12]);
          drawBox(0.82, 0.12, 0.12);

          for (const s of [-1, 1]) {
            mat4.identity(modelMat);
            mat4.translate(modelMat, modelMat, [p.x + s * 0.14, 0.25, p.z]);
            mat4.scale(modelMat, modelMat, [0.08, 0.10, 0.08]);
            drawBox(0.74, 0.08, 0.08);
          }
        }
      } else if (p.type === 'utility') {
        const sx = p.sx || 2.2;
        const sz = p.sz || 1.4;
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [p.x, 0.65, p.z]);
        mat4.rotateY(modelMat, modelMat, p.rotY || 0.0);
        mat4.scale(modelMat, modelMat, [sx, 1.3, sz]);
        drawBox(0.50, 0.52, 0.56);

        if (!simplified) {
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [p.x, 1.35, p.z]);
          mat4.rotateY(modelMat, modelMat, p.rotY || 0.0);
          mat4.scale(modelMat, modelMat, [sx * 1.05, 0.10, sz * 1.05]);
          drawBox(0.42, 0.44, 0.48);

          // Porta/painel frontal
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [p.x, 0.65, p.z]);
          mat4.rotateY(modelMat, modelMat, p.rotY || 0.0);
          mat4.translate(modelMat, modelMat, [0.0, 0.0, sz * 0.50 + 0.03]);
          mat4.scale(modelMat, modelMat, [sx * 0.62, 0.85, 0.04]);
          drawBox(0.30, 0.33, 0.37);
        }
      }
    }
  }
  /* ── 13. Missão: lógica e renderização ───────────────────────────── */

  const SCORE_PER_HOOP  = 1000;
  const SCORE_DECAY     = 80;  // fallback global (não usado se def.decay existir)
  const BOOST_SPEED     = 12;  // m/s de impulso ao passar pelo aro

  function updateMission(dt) {
    const pos   = drone.pos;
    const def   = mission.def;
    const hoops = def.hoops;

    /* Cronômetro da missão */
    if (mission.phase === 'flying' || mission.phase === 'delivery') {
      mission.missionTimer += dt;
    }

    /* Decaimento do score enquanto está na fase flying */
    if (mission.phase === 'flying') {
      mission.hoopTimer += dt;
      const decay = mission.def.decay || SCORE_DECAY;
      /* score parcial para o aro atual */
      mission.score = Math.max(0, SCORE_PER_HOOP - Math.floor(mission.hoopTimer * decay));
    }

    /* Detecção de cruzamento dos aros (baseada em dist. assinada ao plano) */
    for (let i = 0; i < hoops.length; i++) {
      const h        = hoops[i];
      const currDist = signedDist(pos, h);

      if (mission.phase === 'flying' && i === mission.currentHoop) {
        const prev = mission.prevDists[i];
        /* Cruzou o plano? */
        if (prev !== 0 && Math.sign(currDist) !== Math.sign(prev) && Math.sign(currDist) !== 0) {
          if (radialDist(pos, h) < h.radius - (mission.def.hitPad ?? 0.32)) {
            /* Pontua + reseta timer */
            mission.totalScore += Math.max(100, SCORE_PER_HOOP - Math.floor(mission.hoopTimer * (mission.def.decay || SCORE_DECAY)));
            mission.hoopTimer   = 0;
            mission.currentHoop++;

            /* Boost temporário na direção forward do drone + componente vertical */
            const s = Math.sin(drone.yaw), c = Math.cos(drone.yaw);
            drone.boostVel[0] = -s * BOOST_SPEED;
            drone.boostVel[2] = -c * BOOST_SPEED;
            /* Arrasta a velocidade vertical atual para dentro do boost */
            drone.boostVel[1] = drone.vel[1] * 0.6;

            if (mission.currentHoop >= hoops.length) mission.phase = 'delivery';
          }
        }
      }
      mission.prevDists[i] = currDist;
    }

    /* Zona de coleta */
    if (mission.phase === 'pickup') {
      const dx = pos[0] - def.pickup.x, dz = pos[2] - def.pickup.z;
      const inZone = Math.sqrt(dx*dx + dz*dz) < def.pickup.r && pos[1] > 0.5 && pos[1] < 12;
      if (inZone) {
        mission.pickupTimer = Math.min(mission.pickupTimer + dt, FILL_TIME);
        if (mission.pickupTimer >= FILL_TIME) {
          mission.phase = 'flying';
          mission.missionTimer = 0;
          mission.hoopTimer    = 0;
        }
      } else {
        mission.pickupTimer = Math.max(0, mission.pickupTimer - dt * 2);
      }
    }

    /* Zona de entrega */
    if (mission.phase === 'delivery') {
      const dx = pos[0] - def.delivery.x, dz = pos[2] - def.delivery.z;
      const inZone = Math.sqrt(dx*dx + dz*dz) < def.delivery.r && pos[1] > 0.5 && pos[1] < 12;
      if (inZone) {
        mission.deliveryTimer = Math.min(mission.deliveryTimer + dt, FILL_TIME);
        if (mission.deliveryTimer >= FILL_TIME) {
          mission.totalScore += 500; // bonus de entrega
          mission.phase = 'done';
        }
      } else {
        mission.deliveryTimer = Math.max(0, mission.deliveryTimer - dt * 2);
      }
    }

    const total   = MISSION_DEFS.length;
    const current = missionIdx + 1;
    const tSec    = mission.missionTimer.toFixed(1) + 's';
    const dispScore = mission.totalScore + (mission.phase === 'flying' ? mission.score : 0);

    function scoreToRank(s) {
      if (s >= 700) return { letter: 'S', color: '#ffd700' };
      if (s >= 500) return { letter: 'A', color: '#4f4' };
      if (s >= 300) return { letter: 'B', color: '#4af' };
      return                { letter: 'C', color: '#f84' };
    }

    /* HUD */
    switch (mission.phase) {
      case 'pickup':
        mPhaseEl.textContent = `Missão ${current}/${total} — Paire sobre a zona verde`;
        mHoopsEl.style.display   = 'none';
        mScoreRow.style.display  = 'none';
        mBarWrap.style.display   = 'block';
        mBarFill.style.background = '#4f4';
        mBarFill.style.width = (mission.pickupTimer / FILL_TIME * 100).toFixed(0) + '%';
        break;
      case 'flying': {
        const rk = scoreToRank(dispScore);
        mPhaseEl.textContent = `Missão ${current}/${total} — Passe pelos aros!`;
        mHoopsEl.style.display   = 'block';
        mHoopsEl.textContent     = `Aro ${mission.currentHoop + 1} de ${hoops.length}`;
        mScoreRow.style.display  = 'block';
        mBarWrap.style.display   = 'none';
        mScoreEl.textContent     = rk.letter;
        mScoreEl.style.color     = rk.color;
        mTimerEl.textContent     = tSec;
        break;
      }
      case 'delivery': {
        const rk = scoreToRank(mission.totalScore);
        mPhaseEl.textContent = `Missão ${current}/${total} — Paire sobre a zona laranja`;
        mHoopsEl.style.display   = 'none';
        mScoreRow.style.display  = 'block';
        mBarWrap.style.display   = 'block';
        mBarFill.style.background = '#f80';
        mBarFill.style.width = (mission.deliveryTimer / FILL_TIME * 100).toFixed(0) + '%';
        mScoreEl.textContent = rk.letter;
        mScoreEl.style.color = rk.color;
        mTimerEl.textContent = tSec;
        break;
      }
      case 'done': {
        const rk = scoreToRank(mission.totalScore);
        if (missionIdx + 1 < MISSION_DEFS.length) {
          mPhaseEl.textContent = `Missão ${current} OK! Rank: ${rk.letter} | Tempo: ${tSec}`;
          mHoopsEl.style.display   = 'none';
          mScoreRow.style.display  = 'none';
          mBarWrap.style.display   = 'none';
          if (!mission._nextPending) {
            mission._nextPending = true;
            setTimeout(() => { missionIdx++; mission = buildMissionState(missionIdx); }, 2000);
          }
        } else {
          mPhaseEl.textContent = `🎉 Concluído! Rank final: ${rk.letter} | ${tSec}`;
          mHoopsEl.style.display  = 'none';
          mScoreRow.style.display = 'none';
          mBarWrap.style.display  = 'none';
        }
        break;
      }
    }
  }

  /* Disco circular com anel de progresso */
  function drawZone(zone, r, g, b, fillRatio) {
    /* Pulsação sutil */
    const pulse = 1 + Math.sin(frameTime * 2.2) * 0.055;

    /* Disco base */
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [zone.x, 0.06, zone.z]);
    mat4.scale(modelMat, modelMat, [zone.r * pulse, 1, zone.r * pulse]);
    drawDisc(r, g, b);

    /* Disco de progresso */
    if (fillRatio > 0.01) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [zone.x, 0.13, zone.z]);
      const fp = zone.r * Math.min(fillRatio, 1) * pulse;
      mat4.scale(modelMat, modelMat, [fp, 1, fp]);
      drawDisc(
        Math.min(r + 0.45, 1),
        Math.min(g + 0.45, 1),
        Math.min(b + 0.45, 1)
      );
    }
  }

  function drawWaypointArrow() {
    if (mission.phase === 'done') return;

    /* ── Determina alvo ─────────────────────────────────────────── */
    let tx, tz;
    const def = mission.def;
    if (mission.phase === 'pickup') {
      tx = def.pickup.x;
      tz = def.pickup.z;
    } else if (mission.phase === 'flying') {
      const h = def.hoops[mission.currentHoop];
      tx = h.pos[0];
      tz = h.pos[2];
    } else { // delivery
      tx = def.delivery.x;
      tz = def.delivery.z;
    }

    /* ── Ângulo horizontal drone → alvo ────────────────────────── */
    const dx = tx - drone.pos[0];
    const dz = tz - drone.pos[2];
    const angle = Math.atan2(dx, dz); // rotação em Y para apontar -Z→alvo

    /* Oscilação vertical suave */
    const bob = Math.sin(frameTime * 3.0) * 0.12;
    const arrowY = drone.pos[1] + 2.8 + bob;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(loc.uAlpha, 0.55);

    /* Cor: verde=coleta, amarelo=aro, laranja=entrega */
    let ar, ag, ab;
    if (mission.phase === 'pickup')         { ar = 0.1;  ag = 1.0;  ab = 0.2; }
    else if (mission.phase === 'flying')    { ar = 1.0;  ag = 0.9;  ab = 0.0; }
    else                                    { ar = 1.0;  ag = 0.4;  ab = 0.0; }

    bindMesh();

    /* Base da seta: haste (orientação -Z = frente no espaço local) */
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [drone.pos[0], arrowY, drone.pos[2]]);
    mat4.rotateY(modelMat, modelMat, angle);
    mat4.translate(modelMat, modelMat, [0, 0, 0.32]); // deslocamento -Z = frente
    mat4.scale(modelMat, modelMat, [0.10, 0.10, 0.45]);
    drawBox(ar, ag, ab);

    /* Ponta triangular: cubo achatado e mais largo na frente */
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [drone.pos[0], arrowY, drone.pos[2]]);
    mat4.rotateY(modelMat, modelMat, angle);
    mat4.translate(modelMat, modelMat, [0, 0, -0.22]);
    mat4.scale(modelMat, modelMat, [0.34, 0.15, 0.28]);
    drawBox(ar, ag, ab);

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.uniform1f(loc.uAlpha, 1.0);
  }

  /* Aura cilíndrica transparente ao redor da zona */
  function drawAura(zone, r, g, b) {
    const LAYERS = 10;
    const MAX_H  = 3.5;
    const pulse  = 1 + Math.sin(frameTime * 2.2) * 0.055;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (let i = 0; i < LAYERS; i++) {
      const t     = i / (LAYERS - 1);
      const y     = t * MAX_H + 0.08;
      const alpha = 0.30 * (1.0 - t) * (0.7 + 0.3 * Math.sin(frameTime * 2.2 + t * 2));
      const scale = zone.r * pulse; // raio constante — cilindro reto
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [zone.x, y, zone.z]);
      mat4.scale(modelMat, modelMat, [scale, 1, scale]);
      drawDisc(r, g, b, alpha);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.uniform1f(loc.uAlpha, 1.0);
  }

  /* Toro fino real */
  function drawRing(hoop, r, g, b) {
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, hoop.pos);
    /*
     * O toro padrão tem normal +Z (plano XY).
     * Queremos que a normal seja `hoop.normal`.
     * Usamos duas rotações: yaw em torno de Y, depois pitch em torno de X.
     */
    const yaw   = (hoop.angle || 0) * Math.PI / 180;
    const pitch = (hoop.tilt  || 0) * Math.PI / 180;
    mat4.rotateY(modelMat, modelMat, yaw);
    mat4.rotateX(modelMat, modelMat, -pitch);
    mat4.scale(modelMat, modelMat, [hoop.radius, hoop.radius, hoop.radius]);
    drawTorus(r, g, b);
  }

  function drawMission() {
    const ph  = mission.phase;
    const def = mission.def;

    /* ── Zonas no chão (disco opaco) ─────────────────────────── */
    bindDisc();
    if (ph === 'pickup') {
      drawZone(def.pickup, 0.15, 0.80, 0.25, mission.pickupTimer / FILL_TIME);
    } else {
      drawZone(def.pickup, 0.07, 0.18, 0.07, 0);
    }
    if (ph === 'flying' || ph === 'delivery' || ph === 'done') {
      const fill = ph === 'delivery' ? mission.deliveryTimer / FILL_TIME : 0;
      drawZone(def.delivery,
        ph === 'delivery' ? 0.90 : 0.18,
        ph === 'delivery' ? 0.45 : 0.22,
        ph === 'delivery' ? 0.05 : 0.80,
        fill
      );
    }

    /* ── Auras transparentes ──────────────────────────────────── */
    bindDisc();
    if (ph === 'pickup')
      drawAura(def.pickup, 0.20, 1.00, 0.35);
    if (ph === 'flying' || ph === 'delivery' || ph === 'done')
      drawAura(def.delivery,
        ph === 'delivery' ? 1.00 : 0.25,
        ph === 'delivery' ? 0.55 : 0.30,
        ph === 'delivery' ? 0.10 : 1.00
      );

    /* ── Aros (toro) ─────────────────────────────────────────── */
    if (ph === 'flying') {
      bindTorus();
      for (let i = 0; i < def.hoops.length; i++) {
        if (i < mission.currentHoop) continue;
        const isNext = i === mission.currentHoop;
        drawRing(def.hoops[i],
          isNext ? 1.00 : 0.40,
          isNext ? 0.85 : 0.40,
          isNext ? 0.00 : 0.60
        );
      }
    }
    /* ── Seta de waypoint sobre o drone ─────────────────────────── */
    drawWaypointArrow();
  }
  /* ── Dispara o loop ─────────────────────────────────────────── */
  requestAnimationFrame(frame);

})();

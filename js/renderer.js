/* ================================================================
   renderer.js – renderização de céu, chão/ruas e drone
   Expõe: Renderer (namespace global)
   Depende: gl-matrix, City (City.ROAD_HALF_MAIN etc.)
   ================================================================ */

const Renderer = (() => {
  'use strict';

  /* ── Constante de órbita solar/lunar ─────────────────────────── */
  const LIGHT_R = 120;  // exposto para game.js calcular lightPos

  /* ── Estado interno ───────────────────────────────────────────── */
  let _drone = null;
  const _sky = {
    gl      : null,
    posVBO  : null,
    normVBO : null,
    uvVBO   : null,
    idxBuf  : null,
    sunTex  : null,
    moonTex : null,
  };

  /* Offsets locais das 4 hélices (quadricóptero) */
  const PROP_LOCAL = [
    [ 0.8, 0,  0.8],
    [-0.8, 0,  0.8],
    [ 0.8, 0, -0.8],
    [-0.8, 0, -0.8],
  ];

  /* Matriz base do drone (reutilizada por frame) */
  const droneBase = mat4.create();

  /* Textura body do drone */
  let _droneBodyTex = null;
  let _grassTex = null;

  function _loadGrassTex(gl) {
    if (_grassTex) return;
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // Base opaca de grama.
    ctx.fillStyle = 'rgba(70,120,56,1.0)';
    ctx.fillRect(0, 0, size, size);

    // Ruido simples para variar tons sem transparencia.
    for (let i = 0; i < 900; i++) {
      const x = (Math.random() * size) | 0;
      const y = (Math.random() * size) | 0;
      const w = 1 + ((Math.random() * 3) | 0);
      const h = 1 + ((Math.random() * 3) | 0);
      const g = 85 + ((Math.random() * 70) | 0);
      const r = 35 + ((Math.random() * 35) | 0);
      const b = 25 + ((Math.random() * 30) | 0);
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',1.0)';
      ctx.fillRect(x, y, w, h);
    }

    _grassTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, _grassTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  function _loadDroneBodyTex(gl) {
    if (_droneBodyTex) return;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([50, 50, 230, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    };
    img.src = 'js/textures/body.png';
    _droneBodyTex = tex;
  }

  function _createTextureFromCanvas(gl, canvas) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function _createSunTexture(gl) {
    const fallback = (() => {
      const size = 128;
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');

      const grad = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.08, size * 0.5, size * 0.5, size * 0.5);
      grad.addColorStop(0.00, 'rgba(255,255,240,1.0)');
      grad.addColorStop(0.28, 'rgba(255,240,120,0.98)');
      grad.addColorStop(0.64, 'rgba(255,170,70,0.84)');
      grad.addColorStop(1.00, 'rgba(255,120,40,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return c;
    })();

    const tex = _createTextureFromCanvas(gl, fallback);

    // Opcional: se existir sol.png no projeto, substitui a textura procedural.
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    img.src = 'js/textures/sol.png';

    return tex;
  }

  function _createMoonTexture(gl) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([220, 228, 240, 255])
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    img.src = 'js/textures/lua.png';
    return tex;
  }

  function _initSky(gl) {
    if (_sky.gl) return;
    _sky.gl = gl;

    const positions = new Float32Array([
      -0.5, -0.5, 0.0,
       0.5, -0.5, 0.0,
       0.5,  0.5, 0.0,
      -0.5,  0.5, 0.0,
    ]);
    const normals = new Float32Array([
      0.0, 0.0, 1.0,
      0.0, 0.0, 1.0,
      0.0, 0.0, 1.0,
      0.0, 0.0, 1.0,
    ]);
    const uvs = new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      1.0, 1.0,
      0.0, 1.0,
    ]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    _sky.posVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, _sky.posVBO);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    _sky.normVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, _sky.normVBO);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

    _sky.uvVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, _sky.uvVBO);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    _sky.idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _sky.idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    _sky.sunTex = _createSunTexture(gl);
    _sky.moonTex = _createMoonTexture(gl);
  }

  function _bindSkyMesh(rc) {
    const { gl, loc } = rc;

    gl.bindBuffer(gl.ARRAY_BUFFER, _sky.posVBO);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, _sky.normVBO);
    gl.enableVertexAttribArray(loc.aNorm);
    gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 0, 0);

    if (loc.aUV >= 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, _sky.uvVBO);
      gl.enableVertexAttribArray(loc.aUV);
      gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 0, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _sky.idxBuf);
  }

  function _drawSkyBillboard(rc, x, y, z, size, tex, tint, emissive, alpha) {
    const { gl, loc, modelMat, normMat3, viewMat } = rc;

    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [x, y, z]);
    // Copia a rotação inversa da câmera para o quad sempre olhar para o observador.
    modelMat[0] = viewMat[0]; modelMat[1] = viewMat[4]; modelMat[2] = viewMat[8];
    modelMat[4] = viewMat[1]; modelMat[5] = viewMat[5]; modelMat[6] = viewMat[9];
    modelMat[8] = viewMat[2]; modelMat[9] = viewMat[6]; modelMat[10] = viewMat[10];
    mat4.scale(modelMat, modelMat, [size, size, size]);

    gl.uniformMatrix4fv(loc.uModel, false, modelMat);
    mat3.normalFromMat4(normMat3, modelMat);
    gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);

    gl.uniform1f(loc.uUseTex, 1.0);
    gl.uniform1f(loc.uUnlit, 1.0);
    gl.uniform1f(loc.uAlpha, alpha);
    gl.uniform3f(loc.uColor, tint[0], tint[1], tint[2]);
    gl.uniform3f(loc.uEmissive, emissive[0], emissive[1], emissive[2]);
    gl.uniform1f(loc.uSpecular, 0.0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc.uTex, 0);

    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  /* ── Helper de draw interno ───────────────────────────────────── */
  /* rc = { gl, loc, modelMat, normMat3, IDX_COUNT, bindMesh, timeOfDay } */
  function _drawBox(rc, r, g, b) {
    const { gl, loc, modelMat, normMat3, IDX_COUNT } = rc;
    gl.uniformMatrix4fv(loc.uModel, false, modelMat);
    mat3.normalFromMat4(normMat3, modelMat);
    gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
    gl.uniform3f(loc.uColor, r, g, b);
    gl.drawElements(gl.TRIANGLES, IDX_COUNT, gl.UNSIGNED_SHORT, 0);
  }

  /* ── Interpolação da cor do céu ───────────────────────────────── */
  function skyColor(t) {
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
        return [
          k0[1] + (k1[1] - k0[1]) * f,
          k0[2] + (k1[2] - k0[2]) * f,
          k0[3] + (k1[3] - k0[3]) * f,
        ];
      }
    }
    return [0.38, 0.72, 0.98];
  }

  /* ── Sol e Lua ────────────────────────────────────────────────── */
  /* sunX/Y/Z pré-calculados em game.js; timeOfDay vem em rc        */
  function drawSkyObjects(rc, sunHeight, nightBlend, sunX, sunY, sunZ) {
    const { gl, loc } = rc;
    _initSky(gl);

    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    _bindSkyMesh(rc);

    /* ── Sol ────────────────────────────────────────────────────── */
    if (sunHeight > -0.02) {
      const fade = Math.min(1.0, Math.max(0.0, (sunHeight + 0.02) / 0.16));
      const t    = Math.max(0.0, Math.min(1.0, sunHeight * 3.0));
      _drawSkyBillboard(
        rc,
        sunX, sunY, sunZ,
        14.0,
        _sky.sunTex,
        [1.0, 0.92 + t * 0.08, 0.70 + t * 0.30],
        [0.35 * fade, 0.22 * fade, 0.10 * fade],
        fade
      );
    }

    /* ── Lua ────────────────────────────────────────────────────── */
    if (nightBlend > 0.15) {
      const moonAngle = (rc.timeOfDay - 0.25 + 0.52) * Math.PI * 2;
      const mx = Math.cos(moonAngle) * LIGHT_R * 0.92;
      const my = Math.sin(moonAngle) * LIGHT_R * 0.82;
      const mz = Math.sin(moonAngle * 0.35 + 0.8) * 40;
      if (my > -2.0) {
        const mfade = nightBlend * Math.min(1.0, Math.max(0.0, (my + 2.0) / 16.0));
        _drawSkyBillboard(
          rc,
          mx, my, mz,
          9.2,
          _sky.moonTex,
          [1.0, 1.0, 1.0],
          [0.10 * mfade, 0.12 * mfade, 0.16 * mfade],
          mfade
        );
      }
    }

    gl.uniform1f(loc.uUseTex, 0.0);
    gl.uniform1f(loc.uUnlit, 0.0);
    gl.uniform1f(loc.uAlpha, 1.0);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    gl.uniform1f(loc.uSpecular, 1.0);
    if (loc.aUV >= 0) gl.disableVertexAttribArray(loc.aUV);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  /* ── Chão e Ruas ──────────────────────────────────────────────── */
  function drawGroundAndRoads(rc, nightBlend) {
    const { gl, loc, modelMat } = rc;
    rc.bindMesh();
    _loadGrassTex(gl);

    /* Chão – grama com glow urbano noturno */
    const gg = nightBlend * 0.06;
    gl.uniform3f(loc.uEmissive, gg * 0.50, gg * 0.38, gg * 0.10);
    gl.uniform1f(loc.uUseTex, 1.0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, _grassTex);
    gl.uniform1i(loc.uTex, 0);
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [0, -0.15, 0]);
    mat4.scale(modelMat, modelMat, [300, 0.3, 300]);
    _drawBox(rc, 1.0, 1.0, 1.0);
    gl.uniform1f(loc.uUseTex, 0.0);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);

    /* Atalhos para os valores de City */
    const RHM = City.ROAD_HALF_MAIN;
    const RHS = City.ROAD_HALF_SEC;
    const SWM = City.SIDEWALK_W_MAIN;
    const SWS = City.SIDEWALK_W_SEC;

    /* Via principal Leste–Oeste – sem calçadas nos cruzamentos com vias secundárias (x = ±40) */
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [0, 0.02, 0]);
    mat4.scale(modelMat, modelMat, [300, 0.04, 6]);
    _drawBox(rc, 0.22, 0.22, 0.22);
    
    // Calçadas em segmentos, pulando cruzamentos
    const xGap = 4.5;  // distância para pular nos cruzamentos
    for (const zSide of [RHM + SWM * 0.5, -(RHM + SWM * 0.5)]) {
      // Segmentos da via principal L-O
      for (const [xStart, xEnd] of [[-150, -44], [-36, -4], [4, 36], [44, 150]]) {
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [(xStart + xEnd) / 2, 0.028, zSide]);
        mat4.scale(modelMat, modelMat, [(xEnd - xStart), 0.05, SWM]);
        _drawBox(rc, 0.58, 0.58, 0.56);
      }
    }

    /* Via principal Norte–Sul – sem calçadas nos cruzamentos com vias secundárias (z = ±40) */
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [0, 0.02, 0]);
    mat4.scale(modelMat, modelMat, [6, 0.04, 300]);
    _drawBox(rc, 0.22, 0.22, 0.22);
    for (const xSide of [RHM + SWM * 0.5, -(RHM + SWM * 0.5)]) {
      // Segmentos da via principal N-S
      for (const [zStart, zEnd] of [[-150, -44], [-36, -4], [4, 36], [44, 150]]) {
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [xSide, 0.028, (zStart + zEnd) / 2]);
        mat4.scale(modelMat, modelMat, [SWM, 0.05, (zEnd - zStart)]);
        _drawBox(rc, 0.58, 0.58, 0.56);
      }
    }

    /* Vias secundárias z = ±40 – sem calçadas nos cruzamentos com outras vias */
    for (const zOff of [-40, 40]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [0, 0.02, zOff]);
      mat4.scale(modelMat, modelMat, [300, 0.04, 5]);
      _drawBox(rc, 0.22, 0.22, 0.22);
      for (const side of [1, -1]) {
        // Segmentos de calçada, pulando cruzamentos com vias principais (x = 0) e secundárias (x = ±40)
        for (const [xStart, xEnd] of [[-150, -44], [-36, -4], [4, 36], [44, 150]]) {
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [(xStart + xEnd) / 2, 0.028, zOff + side * (RHS + SWS * 0.5)]);
          mat4.scale(modelMat, modelMat, [(xEnd - xStart), 0.05, SWS]);
          _drawBox(rc, 0.56, 0.56, 0.54);
        }
      }
    }

    /* Vias secundárias x = ±40 – sem calçadas nos cruzamentos com outras vias */
    for (const xOff of [-40, 40]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [xOff, 0.02, 0]);
      mat4.scale(modelMat, modelMat, [5, 0.04, 300]);
      _drawBox(rc, 0.22, 0.22, 0.22);
      for (const side of [1, -1]) {
        // Segmentos de calçada, pulando cruzamentos com vias principais (z = 0) e secundárias (z = ±40)
        for (const [zStart, zEnd] of [[-150, -44], [-36, -4], [4, 36], [44, 150]]) {
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [xOff + side * (RHS + SWS * 0.5), 0.028, (zStart + zEnd) / 2]);
          mat4.scale(modelMat, modelMat, [SWS, 0.05, (zEnd - zStart)]);
          _drawBox(rc, 0.56, 0.56, 0.54);
        }
      }
    }
  }

  function drawCrosswalks(rc, nightBlend) {
    const { gl, loc, modelMat } = rc;
    rc.bindMesh();

    const RHS = City.ROAD_HALF_SEC;
    const SWM = City.SIDEWALK_W_MAIN;
    const SWS = City.SIDEWALK_W_SEC;

    const Y_OFFSET = 0.05; // um pouco acima da rua
    const STRIPE_COUNT = 15; // número de stripes por faixa (mais visível)

    // Largura da faixa de pedestre (deixando gap maior das calçadas)
    const MAIN_CROSSWALK_WIDTH = 2 * RHS - 3.0;  // via principal: 4.0 metros
    const SEC_CROSSWALK_WIDTH = 2 * RHS - 3.0;   // via secundária: 3.0 metros

    // Cores
    const WHITE = [1.0, 1.0, 1.0];           // branco das listras
    const ROAD_COLOR = [0.22, 0.22, 0.22];   // cor normal da pista

    // Comprimentos de faixa (apenas a rua, não as calçadas)
    const MAIN_LENGTH = 2 * RHS;  // 6.0 metros
    const SEC_LENGTH = 2 * RHS;   // 5.0 metros

    // Função auxiliar para desenhar faixas
    function drawStripedCrossing(centerX, centerZ, stripeAxis, totalLength, crosswalkWidth) {
      for (let i = 0; i < STRIPE_COUNT; i++) {
        const isWhite = (i % 2 === 0);
        const [r, g, b] = isWhite ? WHITE : ROAD_COLOR;
        const stripeLength = totalLength / STRIPE_COUNT;
        
        if (stripeAxis === 'z') {
          // Faixa estende em Z (via corre em X, rua vai em Z)
          const offset = -totalLength / 2 + i * stripeLength + stripeLength / 2;
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [centerX, Y_OFFSET, centerZ + offset]);
          mat4.scale(modelMat, modelMat, [crosswalkWidth, 0.04, stripeLength]);
          _drawBox(rc, r, g, b);
        } else {
          // Faixa estende em X (via corre em Z, rua vai em X)
          const offset = -totalLength / 2 + i * stripeLength + stripeLength / 2;
          mat4.identity(modelMat);
          mat4.translate(modelMat, modelMat, [centerX + offset, Y_OFFSET, centerZ]);
          mat4.scale(modelMat, modelMat, [stripeLength, 0.04, crosswalkWidth]);
          _drawBox(rc, r, g, b);
        }
      }
    }

    // Faixas deslocadas ANTES dos cruzamentos (3.5 metros antes)
    const OFFSET = 3.5;

    // Faixas na via principal L-O (corre em X, estende em Z) antes dos cruzamentos
    drawStripedCrossing( 40 - OFFSET, 0, 'z', MAIN_LENGTH, MAIN_CROSSWALK_WIDTH);  // Antes de (40, 0)
    drawStripedCrossing(-40 + OFFSET, 0, 'z', MAIN_LENGTH, MAIN_CROSSWALK_WIDTH);  // Antes de (-40, 0)

    // Faixas na via principal N-S (corre em Z, estende em X) antes dos cruzamentos
    drawStripedCrossing(0,  40 - OFFSET, 'x', MAIN_LENGTH, MAIN_CROSSWALK_WIDTH);  // Antes de (0, 40)
    drawStripedCrossing(0, -40 + OFFSET, 'x', MAIN_LENGTH, MAIN_CROSSWALK_WIDTH);  // Antes de (0, -40)

    // Faixas nos cruzamentos de via secundária com via secundária
    for (const [cx, cz] of [[40, 40], [40, -40], [-40, 40], [-40, -40]]) {
      drawStripedCrossing(cx - OFFSET, cz, 'z', SEC_LENGTH, SEC_CROSSWALK_WIDTH);  // L-O
      drawStripedCrossing(cx, cz - OFFSET, 'x', SEC_LENGTH, SEC_CROSSWALK_WIDTH);  // N-S
    }
  }

  /* ── Drone ────────────────────────────────────────────────────── */
  function _buildDroneBase() {
    mat4.identity(droneBase);
    mat4.translate(droneBase, droneBase, _drone.pos);
    mat4.rotateY(droneBase, droneBase,  _drone.yaw);
    mat4.rotateX(droneBase, droneBase, -_drone.tiltPitch);
    mat4.rotateZ(droneBase, droneBase,  _drone.tiltRoll);
  }

  function drawDrone(rc) {
    const { gl, loc, modelMat, normMat3 } = rc;
    _buildDroneBase();
    const lightBase = mat4.create();
    mat4.copy(lightBase, droneBase);

    // Blend dia/noite para acender os farois quando escurece.
    const tod = (typeof rc.timeOfDay === 'number') ? rc.timeOfDay : 0.5;
    const sunAngle = (tod - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const nightBlend = Math.max(0, Math.min(1, -sunHeight * 3.0 + 0.25));

    /* Se drone.obj foi carregado, renderiza o modelo */
    if (window._droneMesh) {
      _loadDroneBodyTex(gl);

      /* Função auxiliar para renderizar uma mesh OBJ com textura */
      function _renderDronePart(mesh, modelMatrix, color, useTex, specular) {
        bindOBJMesh(gl, loc, mesh);
        const textured = (useTex !== false);
        if (textured) {
          gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvVBO);
          if (loc.aUV >= 0) { gl.enableVertexAttribArray(loc.aUV); gl.vertexAttribPointer(loc.aUV, 2, gl.FLOAT, false, 0, 0); }
        }
        gl.uniformMatrix4fv(loc.uModel, false, modelMatrix);
        mat3.normalFromMat4(normMat3, modelMatrix);
        gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
        const c = color || [1.0, 1.0, 1.0];
        gl.uniform3f(loc.uColor, c[0], c[1], c[2]);
        gl.uniform1f(loc.uSpecular, specular !== undefined ? specular : 1.0);
        gl.uniform1f(loc.uUseTex, textured ? 1.0 : 0.0);
        if (textured) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, _droneBodyTex);
          gl.uniform1i(loc.uTex, 0);
        }
        drawOBJMesh(gl, mesh);
      }

      /* Corpo */
      const bodyMat = mat4.create();
      mat4.copy(bodyMat, droneBase);
      mat4.scale(bodyMat, bodyMat, [2.6, 2.6, 2.6]);
      _renderDronePart(window._droneMesh, bodyMat, [1.0, 1.0, 1.0], true, 0.9);
      mat4.copy(lightBase, bodyMat);

      /* Hélices animadas (se existirem no OBJ) */
      if (window._droneHelices) {
        const t = rc.frameTime;
        const spinSpeed = (Math.PI * 2) / 0.145;
        const spinA = -(t * spinSpeed) % (Math.PI * 2);
        const spinB =  (t * spinSpeed) % (Math.PI * 2);
          // offsets dos braços em espaço local (calculados do drone.obj)
          const helixData = {
            helix1: { offset: [-0.328, -0.070,  0.328], spin: spinA },
            helix2: { offset: [ 0.344, -0.070,  0.344], spin: spinB },
            helix3: { offset: [-0.328, -0.070, -0.328], spin: spinA },
            helix4: { offset: [ 0.359, -0.070, -0.313], spin: spinB },
          };
          for (const [name, data] of Object.entries(helixData)) {
            if (!window._droneHelices[name]) continue;
            const hm = mat4.create();
            mat4.copy(hm, droneBase);
            mat4.scale(hm, hm, [2.6, 2.6, 2.6]);
            mat4.translate(hm, hm, data.offset);
            mat4.rotateY(hm, hm, data.spin);
            _renderDronePart(window._droneHelices[name], hm, [0.74, 0.74, 0.74], false, 1.8);
          }
      }

      gl.uniform1f(loc.uUseTex, 0.0);
          gl.uniform1f(loc.uSpecular, 1.0);
      if (loc.aUV >= 0) gl.disableVertexAttribArray(loc.aUV);
    }

    /* Farois do drone: emissivos com feixe suave noturno */
    const headlightStrength = 0.18 + nightBlend * 1.20;
    if (headlightStrength > 0.05) {
      rc.bindMesh();
      gl.uniform1f(loc.uUseTex, 0.0);
      gl.uniform1f(loc.uSpecular, 0.30);
      if (loc.uEmissive) gl.uniform3f(loc.uEmissive, 0.95 * headlightStrength, 0.88 * headlightStrength, 0.60 * headlightStrength);

      for (const side of [-1, 1]) {
        // LED frontal
        mat4.copy(modelMat, lightBase);
        mat4.translate(modelMat, modelMat, [side * 0.07, 0.06, -0.18]);
        mat4.scale(modelMat, modelMat, [0.04, 0.02, 0.02]);
        _drawBox(rc, 1.0, 0.95, 0.80);
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      if (loc.uEmissive) gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);

      const beamSegments = [
        { alpha: 0.28, x: 0.075, z: -0.16, yaw: 0.05, sx: 0.075, sy: 0.060, sz: 0.22, color: [1.0, 0.86, 0.66] },
        { alpha: 0.24, x: 0.080, z: -0.24, yaw: 0.07, sx: 0.080, sy: 0.060, sz: 0.24, color: [1.0, 0.88, 0.69] },
        { alpha: 0.21, x: 0.086, z: -0.32, yaw: 0.09, sx: 0.085, sy: 0.058, sz: 0.26, color: [1.0, 0.90, 0.73] },
        { alpha: 0.18, x: 0.093, z: -0.40, yaw: 0.11, sx: 0.090, sy: 0.057, sz: 0.28, color: [1.0, 0.92, 0.77] },
        { alpha: 0.15, x: 0.101, z: -0.49, yaw: 0.13, sx: 0.095, sy: 0.055, sz: 0.30, color: [1.0, 0.94, 0.81] },
        { alpha: 0.12, x: 0.110, z: -0.58, yaw: 0.15, sx: 0.102, sy: 0.053, sz: 0.32, color: [1.0, 0.96, 0.85] },
        { alpha: 0.10, x: 0.120, z: -0.68, yaw: 0.17, sx: 0.108, sy: 0.052, sz: 0.34, color: [1.0, 0.97, 0.88] },
        { alpha: 0.08, x: 0.131, z: -0.79, yaw: 0.19, sx: 0.115, sy: 0.050, sz: 0.36, color: [1.0, 0.98, 0.91] },
      ];

      for (const side of [-1, 1]) {
        // Segmentos progressivos: forte na saida e mais claro no final
        for (const seg of beamSegments) {
          gl.uniform1f(loc.uAlpha, seg.alpha * headlightStrength);
          mat4.copy(modelMat, lightBase);
          mat4.translate(modelMat, modelMat, [side * seg.x, 0.06, seg.z]);
          mat4.rotateY(modelMat, modelMat, -side * seg.yaw);
          mat4.scale(modelMat, modelMat, [seg.sx, seg.sy, seg.sz]);
          _drawBox(rc, seg.color[0], seg.color[1], seg.color[2]);
        }
      }

      gl.uniform1f(loc.uAlpha, 1.0);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      if (loc.uEmissive) gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
      gl.uniform1f(loc.uSpecular, 1.0);
    }

    /* Caixa de entrega: aparece quando o drone está transportando */
    const phase = (typeof Mission !== 'undefined' && Mission.state) ? Mission.state.phase : '';
    const carrying = (phase === 'flying' || phase === 'delivery');
    if (carrying) {
      const cargoBob = Math.sin(rc.frameTime * 5.0) * 0.008;
      rc.bindMesh();
      gl.uniform1f(loc.uUseTex, 0.0);
      gl.uniform1f(loc.uSpecular, 0.18);

      // caixa maior (papelao)
      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, [0.0, -0.44 + cargoBob, 0.04]);
      mat4.scale(modelMat, modelMat, [0.56, 0.36, 0.44]);
      _drawBox(rc, 0.66, 0.50, 0.30);

      // fita no topo
      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, [0.0, -0.24 + cargoBob, 0.04]);
      mat4.scale(modelMat, modelMat, [0.58, 0.03, 0.08]);
      _drawBox(rc, 0.82, 0.74, 0.56);

      // sacola envolvendo a caixa (corpo)
      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, [0.0, -0.43 + cargoBob, 0.04]);
      mat4.scale(modelMat, modelMat, [0.62, 0.40, 0.48]);
      _drawBox(rc, 0.72, 0.66, 0.52);

      // abertura superior da sacola
      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, [0.0, -0.22 + cargoBob, 0.04]);
      mat4.scale(modelMat, modelMat, [0.54, 0.02, 0.40]);
      _drawBox(rc, 0.83, 0.77, 0.63);

      // alcas da sacola
      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, [-0.22, -0.16 + cargoBob, 0.04]);
      mat4.scale(modelMat, modelMat, [0.03, 0.12, 0.03]);
      _drawBox(rc, 0.56, 0.49, 0.36);

      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, [0.22, -0.16 + cargoBob, 0.04]);
      mat4.scale(modelMat, modelMat, [0.03, 0.12, 0.03]);
      _drawBox(rc, 0.56, 0.49, 0.36);

      // bracinhos do drone segurando a sacola
      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, [-0.25, -0.02 + cargoBob * 0.5, 0.04]);
      mat4.rotateZ(modelMat, modelMat, 0.28);
      mat4.scale(modelMat, modelMat, [0.05, 0.30, 0.05]);
      _drawBox(rc, 0.42, 0.42, 0.44);

      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, [0.25, -0.02 + cargoBob * 0.5, 0.04]);
      mat4.rotateZ(modelMat, modelMat, -0.28);
      mat4.scale(modelMat, modelMat, [0.05, 0.30, 0.05]);
      _drawBox(rc, 0.42, 0.42, 0.44);

      gl.uniform1f(loc.uSpecular, 1.0);
    }
  }

  /* ── API pública ──────────────────────────────────────────────── */
  return {
    LIGHT_R,   // usado por game.js para calcular lightPos / sunAngle

    /** Chame após criar o drone, antes do loop.
     *  @param {object} droneRef – referência ao objeto drone de game.js */
    init(droneRef, glRef) {
      _drone = droneRef;
      if (glRef) _initSky(glRef);
    },

    /** Retorna [r,g,b] da cor do céu para timeOfDay ∈ [0,1]. */
    skyColor,

    /** Desenha sol e lua.
     *  rc deve conter: gl, loc, modelMat, normMat3, IDX_COUNT, timeOfDay */
    drawSkyObjects,

    /** Desenha chão (grama) e todas as faixas de rua.
     *  rc deve conter: gl, loc, modelMat, normMat3, IDX_COUNT, bindMesh */
    drawGroundAndRoads,

    /** Desenha faixas de pedestre (zebra crossings) nos cruzamentos.
     *  rc deve conter: gl, loc, modelMat, bindMesh */
    drawCrosswalks,

    /** Desenha o drone (corpo + cúpula + nariz + guardas).
     *  rc deve conter: gl, loc, modelMat, normMat3, IDX_COUNT, bindMesh */
    drawDrone,
  };
})();
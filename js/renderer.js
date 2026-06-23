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

    /* Chão – grama com glow urbano noturno */
    const gg = nightBlend * 0.06;
    gl.uniform3f(loc.uEmissive, gg * 0.50, gg * 0.38, gg * 0.10);
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [0, -0.15, 0]);
    mat4.scale(modelMat, modelMat, [300, 0.3, 300]);
    _drawBox(rc, 0.28, 0.58, 0.22);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);

    /* Atalhos para os valores de City */
    const RHM = City.ROAD_HALF_MAIN;
    const RHS = City.ROAD_HALF_SEC;
    const SWM = City.SIDEWALK_W_MAIN;
    const SWS = City.SIDEWALK_W_SEC;

    /* Via principal Leste–Oeste */
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [0, 0.02, 0]);
    mat4.scale(modelMat, modelMat, [300, 0.04, 6]);
    _drawBox(rc, 0.22, 0.22, 0.22);
    for (const zSide of [RHM + SWM * 0.5, -(RHM + SWM * 0.5)]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [0, 0.028, zSide]);
      mat4.scale(modelMat, modelMat, [300, 0.05, SWM]);
      _drawBox(rc, 0.58, 0.58, 0.56);
    }

    /* Via principal Norte–Sul */
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [0, 0.02, 0]);
    mat4.scale(modelMat, modelMat, [6, 0.04, 300]);
    _drawBox(rc, 0.22, 0.22, 0.22);
    for (const xSide of [RHM + SWM * 0.5, -(RHM + SWM * 0.5)]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [xSide, 0.028, 0]);
      mat4.scale(modelMat, modelMat, [SWM, 0.05, 300]);
      _drawBox(rc, 0.58, 0.58, 0.56);
    }

    /* Vias secundárias z = ±40 */
    for (const zOff of [-40, 40]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [0, 0.02, zOff]);
      mat4.scale(modelMat, modelMat, [300, 0.04, 5]);
      _drawBox(rc, 0.22, 0.22, 0.22);
      for (const side of [1, -1]) {
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [0, 0.028, zOff + side * (RHS + SWS * 0.5)]);
        mat4.scale(modelMat, modelMat, [300, 0.05, SWS]);
        _drawBox(rc, 0.56, 0.56, 0.54);
      }
    }

    /* Vias secundárias x = ±40 */
    for (const xOff of [-40, 40]) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [xOff, 0.02, 0]);
      mat4.scale(modelMat, modelMat, [5, 0.04, 300]);
      _drawBox(rc, 0.22, 0.22, 0.22);
      for (const side of [1, -1]) {
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [xOff + side * (RHS + SWS * 0.5), 0.028, 0]);
        mat4.scale(modelMat, modelMat, [SWS, 0.05, 300]);
        _drawBox(rc, 0.56, 0.56, 0.54);
      }
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
    const { modelMat } = rc;
    rc.bindMesh();
    _buildDroneBase();

    /* Corpo principal */
    mat4.copy(modelMat, droneBase);
    mat4.scale(modelMat, modelMat, [1.8, 0.25, 1.8]);
    _drawBox(rc, 0.15, 0.15, 0.80);

    /* Cúpula / cabine */
    mat4.copy(modelMat, droneBase);
    mat4.translate(modelMat, modelMat, [0, 0.22, 0]);
    mat4.scale(modelMat, modelMat, [0.65, 0.35, 0.65]);
    _drawBox(rc, 0.20, 0.20, 0.90);

    /* Indicador de nariz (amarelo) */
    mat4.copy(modelMat, droneBase);
    mat4.translate(modelMat, modelMat, [0, 0, -1.0]);
    mat4.scale(modelMat, modelMat, [0.22, 0.18, 0.22]);
    _drawBox(rc, 1.0, 0.85, 0.0);

    /* Guardas das hélices (vermelho nos 4 cantos) */
    for (let i = 0; i < PROP_LOCAL.length; i++) {
      mat4.copy(modelMat, droneBase);
      mat4.translate(modelMat, modelMat, PROP_LOCAL[i]);
      mat4.scale(modelMat, modelMat, [0.38, 0.10, 0.38]);
      _drawBox(rc, 0.90, 0.15, 0.15);
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

    /** Desenha o drone (corpo + cúpula + nariz + guardas).
     *  rc deve conter: gl, loc, modelMat, normMat3, IDX_COUNT, bindMesh */
    drawDrone,
  };
})();
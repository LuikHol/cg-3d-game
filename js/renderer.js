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

  /* Offsets locais das 4 hélices (quadricóptero) */
  const PROP_LOCAL = [
    [ 0.8, 0,  0.8],
    [-0.8, 0,  0.8],
    [ 0.8, 0, -0.8],
    [-0.8, 0, -0.8],
  ];

  /* Matriz base do drone (reutilizada por frame) */
  const droneBase = mat4.create();

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
    const { gl, loc, modelMat, normMat3, IDX_COUNT } = rc;
    gl.disable(gl.CULL_FACE);
    gl.uniform1f(loc.uSpecular, 0.0);

    /* ── Sol ────────────────────────────────────────────────────── */
    if (sunHeight > -0.10) {
      const fade = Math.min(1.0, (sunHeight + 0.10) / 0.14);
      const t    = Math.max(0.0, Math.min(1.0, sunHeight * 3.0));
      const sr   = 1.0;
      const sg   = 0.55 + t * 0.45;
      const sb   = 0.15 + t * 0.85;
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

    /* ── Lua ────────────────────────────────────────────────────── */
    if (nightBlend > 0.05) {
      const moonAngle = (rc.timeOfDay - 0.25 + 0.52) * Math.PI * 2;
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
    gl.uniform1f(loc.uSpecular, 1.0);
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
    init(droneRef) { _drone = droneRef; },

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
/* ================================================================
   mission.js – dados, lógica e renderização das missões
   Depende: gl-matrix (mat4, mat3), sendo chamado de game.js
   Expõe: Mission (namespace global)
   ================================================================ */

const Mission = (() => {
  'use strict';

  /* ── Definições das missões ───────────────────────────────────── */
  const MISSION_DEFS = [
    /* ─── Missão 1 · Iniciante · 3 aros ─────────────────────────── */
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
    /* ─── Missão 2 · Fácil · 4 aros ─────────────────────────────── */
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
    /* ─── Missão 3 · Médio · 5 aros ─────────────────────────────── */
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
    /* ─── Missão 4 · Difícil · 6 aros ───────────────────────────── */
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
    /* ─── Missão 5 · Expert · 8 aros ────────────────────────────── */
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

  /* ── Constantes ───────────────────────────────────────────────── */
  const FILL_TIME       = 0.5;
  const SCORE_PER_HOOP  = 1000;
  const SCORE_DECAY     = 80;
  const BOOST_SPEED     = 12;

  /* ── Estado interno ───────────────────────────────────────────── */
  let _drone      = null;   // referência ao objeto drone de game.js
  let _missionIdx = 0;
  let _mission    = null;

  /* ── Diálogo estilo visual novel (aceite da missão) ──────────── */
  const PICKUP_DIALOGUES = [
    { name: 'Maka',  title: 'Moradora', line: 'Oi piloto! Quero que entregue essa minha encomenda com cuidado, por favor.' },
    { name: 'Diego', title: 'Cliente',  line: 'Valeu por aceitar! Essa entrega é urgente, preciso dela ainda hoje.' },
    { name: 'Lia',   title: 'Cliente',  line: 'Confio em você. Leve essa caixa direitinho e me avise quando chegar.' },
    { name: 'Ravi',  title: 'Comerciante', line: 'Essa encomenda não pode atrasar. Conta contigo para uma entrega perfeita.' },
    { name: 'Nina',  title: 'Cliente VIP', line: 'Perfeito, piloto! Quero essa encomenda entregue sem nenhum arranhão.' },
  ];

  let _vn = null;
  function _ensureVN() {
    if (_vn) return _vn;

    const layer = document.createElement('div');
    layer.id = 'vn-layer';
    layer.innerHTML = `
      <div id="vn-character">
        <img id="vn-portrait" src="js/textures/maka.png" alt="Personagem da missão">
      </div>
      <div id="vn-box">
        <div id="vn-name"></div>
        <div id="vn-text"></div>
        <div id="vn-next" style="display:none"><span class="arrow">▶</span><span>Continuar</span></div>
      </div>
    `;
    document.body.appendChild(layer);

    _vn = {
      layer,
      nameEl: layer.querySelector('#vn-name'),
      textEl: layer.querySelector('#vn-text'),
      continueBtn: layer.querySelector('#vn-next'),
      text: '',
      visibleChars: 0,
      cps: 44,
      active: false,
      onContinue: null,
    };

    _vn.continueBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      if (!_vn.active) return;
      if (_vn.visibleChars < _vn.text.length) {
        _vn.visibleChars = _vn.text.length;
        _vn.textEl.textContent = _vn.text;
        _vn.continueBtn.style.display = 'inline-block';
        return;
      }
      _vn.active = false;
      _vn.layer.classList.remove('vn-show');
      _vn.continueBtn.style.display = 'none';
      document.body.classList.remove('dialogue-open');
      const cb = _vn.onContinue;
      _vn.onContinue = null;
      if (cb) cb();

      // Devolve o controle normal do mouse ao jogo após fechar o diálogo.
      const canvas = document.getElementById('canvas');
      if (canvas && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    });

    return _vn;
  }

  function _showPickupDialogue(missionIdx, onContinue) {
    const vn = _ensureVN();
    const data = PICKUP_DIALOGUES[missionIdx % PICKUP_DIALOGUES.length];
    vn.text = data.line;
    vn.visibleChars = 0;
    vn.active = true;
    vn.onContinue = onContinue || null;
    vn.nameEl.textContent = data.name + ' • ' + data.title;
    vn.textEl.textContent = '';
    vn.continueBtn.style.display = 'none';
    vn.layer.classList.add('vn-show');
    document.body.classList.add('dialogue-open');
  }

  function _updateVN(dt) {
    if (!_vn || !_vn.active) return;

    if (_vn.visibleChars < _vn.text.length) {
      _vn.visibleChars = Math.min(_vn.text.length, _vn.visibleChars + _vn.cps * dt);
      _vn.textEl.textContent = _vn.text.slice(0, _vn.visibleChars | 0);
      return;
    }

    _vn.continueBtn.style.display = 'inline-block';
  }

  /* ── HUD (lazy) ───────────────────────────────────────────────── */
  let _hud = null;
  function getHud() {
    if (!_hud) {
      _hud = {
        phase   : document.getElementById('m-phase'),
        hoops   : document.getElementById('m-hoops'),
        barWrap : document.getElementById('m-bar-wrap'),
        barFill : document.getElementById('m-bar-fill'),
        score   : document.getElementById('m-score'),
        timer   : document.getElementById('m-timer'),
        scoreRow: document.getElementById('m-score-row'),
      };
    }
    return _hud;
  }

  /* ── Geometria dos aros (normais pré-computadas) ──────────────── */
  function _computeNormals(def) {
    def.hoops.forEach(h => {
      if (!h.normal) {
        const yaw   = (h.angle || 0) * Math.PI / 180;
        const pitch = (h.tilt  || 0) * Math.PI / 180;
        h.normal = [
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch),
        ];
      }
    });
  }

  /* ── Distância assinada ao plano do aro ───────────────────────── */
  function signedDist(pos, h) {
    const n = h.normal;
    return (pos[0] - h.pos[0]) * n[0]
         + (pos[1] - h.pos[1]) * n[1]
         + (pos[2] - h.pos[2]) * n[2];
  }

  /* ── Distância radial ao centro do aro ───────────────────────── */
  function radialDist(pos, h) {
    const dx = pos[0] - h.pos[0];
    const dy = pos[1] - h.pos[1];
    const dz = pos[2] - h.pos[2];
    const n  = h.normal;
    const proj = dx*n[0] + dy*n[1] + dz*n[2];
    const px = dx - proj*n[0];
    const py = dy - proj*n[1];
    const pz = dz - proj*n[2];
    return Math.sqrt(px*px + py*py + pz*pz);
  }

  /* ── Constrói estado inicial de uma missão ────────────────────── */
  function buildMissionState(idx) {
    const def = MISSION_DEFS[idx];
    _computeNormals(def);
    return {
      phase        : 'pickup',
      _acceptPending: false,
      pickupTimer  : 0,
      deliveryTimer: 0,
      currentHoop  : 0,
      score        : 0,
      totalScore   : 0,
      missionTimer : 0,
      hoopTimer    : 0,
      def,
      prevDists: def.hoops.map(h => signedDist(_drone.pos, h)),
    };
  }

  /* ── Lógica por frame ─────────────────────────────────────────── */
  function update(dt) {
    const pos   = _drone.pos;
    const def   = _mission.def;
    const hoops = def.hoops;

    if (_mission.phase === 'flying' || _mission.phase === 'delivery') {
      _mission.missionTimer += dt;
    }

    if (_mission.phase === 'flying') {
      _mission.hoopTimer += dt;
      const decay = def.decay || SCORE_DECAY;
      _mission.score = Math.max(0, SCORE_PER_HOOP - Math.floor(_mission.hoopTimer * decay));
    }

    /* Detecção de cruzamento dos aros */
    for (let i = 0; i < hoops.length; i++) {
      const h        = hoops[i];
      const currDist = signedDist(pos, h);

      if (_mission.phase === 'flying' && i === _mission.currentHoop) {
        const prev = _mission.prevDists[i];
        if (prev !== 0 && Math.sign(currDist) !== Math.sign(prev) && Math.sign(currDist) !== 0) {
          if (radialDist(pos, h) < h.radius - (_mission.def.hitPad ?? 0.32)) {
            _mission.totalScore += Math.max(100, SCORE_PER_HOOP - Math.floor(_mission.hoopTimer * (def.decay || SCORE_DECAY)));
            _mission.hoopTimer   = 0;
            _mission.currentHoop++;

            const s = Math.sin(_drone.yaw), c = Math.cos(_drone.yaw);
            _drone.boostVel[0] = -s * BOOST_SPEED;
            _drone.boostVel[2] = -c * BOOST_SPEED;
            _drone.boostVel[1] = _drone.vel[1] * 0.6;

            if (_mission.currentHoop >= hoops.length) _mission.phase = 'delivery';
          }
        }
      }
      _mission.prevDists[i] = currDist;
    }

    /* Zona de coleta */
    if (_mission.phase === 'pickup') {
      const dx = pos[0] - def.pickup.x, dz = pos[2] - def.pickup.z;
      const inZone = Math.sqrt(dx*dx + dz*dz) < def.pickup.r && pos[1] > 0.5 && pos[1] < 12;
      if (_mission._acceptPending) {
        _mission.pickupTimer = FILL_TIME;
      } else if (inZone) {
        _mission.pickupTimer = Math.min(_mission.pickupTimer + dt, FILL_TIME);
        if (_mission.pickupTimer >= FILL_TIME) {
          _mission._acceptPending = true;
          _showPickupDialogue(_missionIdx, () => {
            _mission._acceptPending = false;
            _mission.phase = 'flying';
            _mission.missionTimer = 0;
            _mission.hoopTimer = 0;
          });
        }
      } else {
        _mission.pickupTimer = Math.max(0, _mission.pickupTimer - dt * 2);
      }
    }

    /* Zona de entrega */
    if (_mission.phase === 'delivery') {
      const dx = pos[0] - def.delivery.x, dz = pos[2] - def.delivery.z;
      const inZone = Math.sqrt(dx*dx + dz*dz) < def.delivery.r && pos[1] > 0.5 && pos[1] < 12;
      if (inZone) {
        _mission.deliveryTimer = Math.min(_mission.deliveryTimer + dt, FILL_TIME);
        if (_mission.deliveryTimer >= FILL_TIME) {
          _mission.totalScore += 500;
          _mission.phase = 'done';
        }
      } else {
        _mission.deliveryTimer = Math.max(0, _mission.deliveryTimer - dt * 2);
      }
    }

    /* HUD */
    const hud     = getHud();
    const total   = MISSION_DEFS.length;
    const current = _missionIdx + 1;
    const tSec    = _mission.missionTimer.toFixed(1) + 's';
    const dispScore = _mission.totalScore + (_mission.phase === 'flying' ? _mission.score : 0);

    function scoreToRank(s) {
    const maxS = hoops.length * SCORE_PER_HOOP + 500;
    const ratio = s / maxS;
    if (ratio >= 0.88) return { letter: 'S', color: '#ffd700' };
    if (ratio >= 0.72) return { letter: 'A', color: '#4f4'    };
    if (ratio >= 0.55) return { letter: 'B', color: '#4af'    };
    return               { letter: 'C', color: '#f84'    };
    }

    switch (_mission.phase) {
      case 'pickup':
        hud.phase.textContent    = _mission._acceptPending
          ? `Missão ${current}/${total} — Clique em Continuar para iniciar`
          : `Missão ${current}/${total} — Paire sobre a zona verde`;
        hud.hoops.style.display   = 'none';
        hud.scoreRow.style.display = 'none';
        hud.barWrap.style.display  = 'block';
        hud.barFill.style.background = '#4f4';
        hud.barFill.style.width = (_mission.pickupTimer / FILL_TIME * 100).toFixed(0) + '%';
        break;
      case 'flying': {
        const rk = scoreToRank(dispScore);
        hud.phase.textContent    = `Missão ${current}/${total} — Passe pelos aros!`;
        hud.hoops.style.display   = 'block';
        hud.hoops.textContent     = `Aro ${_mission.currentHoop + 1} de ${hoops.length}`;
        hud.scoreRow.style.display = 'block';
        hud.barWrap.style.display  = 'none';
        hud.score.textContent      = rk.letter;
        hud.score.style.color      = rk.color;
        hud.timer.textContent      = tSec;
        break;
      }
      case 'delivery': {
        const rk = scoreToRank(_mission.totalScore);
        hud.phase.textContent    = `Missão ${current}/${total} — Paire sobre a zona laranja`;
        hud.hoops.style.display   = 'none';
        hud.scoreRow.style.display = 'block';
        hud.barWrap.style.display  = 'block';
        hud.barFill.style.background = '#f80';
        hud.barFill.style.width = (_mission.deliveryTimer / FILL_TIME * 100).toFixed(0) + '%';
        hud.score.textContent = rk.letter;
        hud.score.style.color = rk.color;
        hud.timer.textContent = tSec;
        break;
      }
      case 'done': {
        const rk = scoreToRank(_mission.totalScore);
        if (_missionIdx + 1 < MISSION_DEFS.length) {
          hud.phase.textContent    = `Missão ${current} OK! Rank: ${rk.letter} | Tempo: ${tSec}`;
          hud.hoops.style.display   = 'none';
          hud.scoreRow.style.display = 'none';
          hud.barWrap.style.display  = 'none';
          if (!_mission._nextPending) {
            _mission._nextPending = true;
            setTimeout(() => {
              _missionIdx++;
              _mission = buildMissionState(_missionIdx);
            }, 2000);
          }
        } else {
          hud.phase.textContent    = '🎉 Concluído! Rank final: ' + rk.letter + ' | ' + tSec;
          hud.hoops.style.display   = 'none';
          hud.scoreRow.style.display = 'none';
          hud.barWrap.style.display  = 'none';
        }
        break;
      }
    }

    _updateVN(dt);
  }

  /* ── Helpers de draw internos ─────────────────────────────────── */
  /* rc = { gl, loc, modelMat, normMat3, IDX_COUNT, DISC_COUNT, TOR_IDX_COUNT,
            bindMesh, bindDisc, bindTorus, frameTime }              */

  function _drawBox(rc, r, g, b) {
    const { gl, loc, modelMat, normMat3, IDX_COUNT } = rc;
    gl.uniformMatrix4fv(loc.uModel, false, modelMat);
    mat3.normalFromMat4(normMat3, modelMat);
    gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
    gl.uniform3f(loc.uColor, r, g, b);
    gl.drawElements(gl.TRIANGLES, IDX_COUNT, gl.UNSIGNED_SHORT, 0);
  }

  function _drawDisc(rc, r, g, b, alpha) {
    const { gl, loc, modelMat, normMat3, DISC_COUNT } = rc;
    gl.uniform1f(loc.uAlpha, alpha !== undefined ? alpha : 1.0);
    gl.uniformMatrix4fv(loc.uModel, false, modelMat);
    mat3.normalFromMat4(normMat3, modelMat);
    gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
    gl.uniform3f(loc.uColor, r, g, b);
    gl.drawArrays(gl.TRIANGLES, 0, DISC_COUNT);
  }

  function _drawTorus(rc, r, g, b) {
    const { gl, loc, modelMat, normMat3, TOR_IDX_COUNT } = rc;
    gl.uniformMatrix4fv(loc.uModel, false, modelMat);
    mat3.normalFromMat4(normMat3, modelMat);
    gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
    gl.uniform3f(loc.uColor, r, g, b);
    gl.drawElements(gl.TRIANGLES, TOR_IDX_COUNT, gl.UNSIGNED_SHORT, 0);
  }

  /* ── Renderização ─────────────────────────────────────────────── */

  function _drawZone(rc, zone, r, g, b, fillRatio) {
    const { modelMat } = rc;
    const pulse = 1 + Math.sin(rc.frameTime * 2.2) * 0.055;

    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, [zone.x, 0.06, zone.z]);
    mat4.scale(modelMat, modelMat, [zone.r * pulse, 1, zone.r * pulse]);
    _drawDisc(rc, r, g, b);

    if (fillRatio > 0.01) {
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [zone.x, 0.13, zone.z]);
      const fp = zone.r * Math.min(fillRatio, 1) * pulse;
      mat4.scale(modelMat, modelMat, [fp, 1, fp]);
      _drawDisc(rc, Math.min(r+0.45,1), Math.min(g+0.45,1), Math.min(b+0.45,1));
    }
  }

  function _drawAura(rc, zone, r, g, b) {
    const { gl, loc, modelMat } = rc;
    const LAYERS = 10, MAX_H = 3.5;
    const pulse = 1 + Math.sin(rc.frameTime * 2.2) * 0.055;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (let i = 0; i < LAYERS; i++) {
      const t     = i / (LAYERS - 1);
      const y     = t * MAX_H + 0.08;
      const alpha = 0.30 * (1.0 - t) * (0.7 + 0.3 * Math.sin(rc.frameTime * 2.2 + t * 2));
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [zone.x, y, zone.z]);
      mat4.scale(modelMat, modelMat, [zone.r * pulse, 1, zone.r * pulse]);
      _drawDisc(rc, r, g, b, alpha);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.uniform1f(loc.uAlpha, 1.0);
  }

  function _drawRing(rc, hoop, r, g, b) {
    const { modelMat } = rc;
    mat4.identity(modelMat);
    mat4.translate(modelMat, modelMat, hoop.pos);
    const yaw   = (hoop.angle || 0) * Math.PI / 180;
    const pitch = (hoop.tilt  || 0) * Math.PI / 180;
    mat4.rotateY(modelMat, modelMat, yaw);
    mat4.rotateX(modelMat, modelMat, -pitch);
    mat4.scale(modelMat, modelMat, [hoop.radius, hoop.radius, hoop.radius]);
    _drawTorus(rc, r, g, b);
  }

  function _drawWaypointArrow(rc) {
    if (_mission.phase === 'done') return;
    const { gl, loc, modelMat, normMat3 } = rc;
    const def = _mission.def;
    let tx, tz, ty;
    if (_mission.phase === 'pickup') {
        tx = def.pickup.x;  tz = def.pickup.z;  ty = 2.0;
    } else if (_mission.phase === 'flying') {
        const h = def.hoops[_mission.currentHoop];
        tx = h.pos[0];  tz = h.pos[2];  ty = h.pos[1];
    } else {
        tx = def.delivery.x;  tz = def.delivery.z;  ty = 2.0;
    }

    const dx    = tx - _drone.pos[0];
    const dy    = ty - _drone.pos[1];
    const dz    = tz - _drone.pos[2];
    const hDist = Math.sqrt(dx*dx + dz*dz);
    const angle = Math.atan2(dx, dz);
    const pitch = Math.max(-1.2, Math.min(1.2, Math.atan2(dy, Math.max(hDist, 0.01))));
    const bob   = Math.sin(rc.frameTime * 3.0) * 0.12;
    const arrowY = _drone.pos[1] + 2.8 + bob;

    let ar, ag, ab;
    if      (_mission.phase === 'pickup') { ar = 0.1; ag = 1.0; ab = 0.2; }
    else if (_mission.phase === 'flying') { ar = 1.0; ag = 0.9; ab = 0.0; }
    else                                  { ar = 1.0; ag = 0.4; ab = 0.0; }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(loc.uAlpha, 0.85);

    /* Se Arrow.obj foi carregado, renderiza o modelo */
    if (window._arrowMesh) {
      bindOBJMesh(gl, loc, window._arrowMesh);
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [_drone.pos[0], arrowY, _drone.pos[2]]);
      mat4.rotateY(modelMat, modelMat, angle);
      mat4.rotateX(modelMat, modelMat, -pitch + Math.PI);
      mat4.scale(modelMat, modelMat, [0.45, 0.45, 0.45]);
      gl.uniformMatrix4fv(loc.uModel, false, modelMat);
      mat3.normalFromMat4(normMat3, modelMat);
      gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
      gl.uniform3f(loc.uColor, ar, ag, ab);
      drawOBJMesh(gl, window._arrowMesh);
    } else {
      /* Fallback: desenha com caixas se modelo não foi carregado */
      rc.bindMesh();

      /* Haste */
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [_drone.pos[0], arrowY, _drone.pos[2]]);
      mat4.rotateY(modelMat, modelMat, angle);
      mat4.rotateX(modelMat, modelMat, -pitch);
      mat4.translate(modelMat, modelMat, [0, 0, 0.32]);
      mat4.scale(modelMat, modelMat, [0.10, 0.10, 0.45]);
      _drawBox(rc, ar, ag, ab);

      /* Cabeça */
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [_drone.pos[0], arrowY, _drone.pos[2]]);
      mat4.rotateY(modelMat, modelMat, angle);
      mat4.rotateX(modelMat, modelMat, -pitch);
      mat4.translate(modelMat, modelMat, [0, 0, -0.22]);
      mat4.scale(modelMat, modelMat, [0.34, 0.15, 0.28]);
      _drawBox(rc, ar, ag, ab);
    }

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.uniform1f(loc.uAlpha, 1.0);
  }

  function draw(rc) {
    const ph  = _mission.phase;
    const def = _mission.def;

    /* ── Zonas no chão ────────────────────────────────────────── */
    rc.bindDisc();
    if (ph === 'pickup') {
      _drawZone(rc, def.pickup, 0.15, 0.80, 0.25, _mission.pickupTimer / FILL_TIME);
    } else {
      _drawZone(rc, def.pickup, 0.07, 0.18, 0.07, 0);
    }
    if (ph === 'flying' || ph === 'delivery' || ph === 'done') {
      const fill = ph === 'delivery' ? _mission.deliveryTimer / FILL_TIME : 0;
      _drawZone(rc, def.delivery,
        ph === 'delivery' ? 0.90 : 0.18,
        ph === 'delivery' ? 0.45 : 0.22,
        ph === 'delivery' ? 0.05 : 0.80,
        fill
      );
    }

    /* ── Auras transparentes ──────────────────────────────────── */
    rc.bindDisc();
    if (ph === 'pickup')
      _drawAura(rc, def.pickup, 0.20, 1.00, 0.35);
    if (ph === 'flying' || ph === 'delivery' || ph === 'done')
      _drawAura(rc, def.delivery,
        ph === 'delivery' ? 1.00 : 0.25,
        ph === 'delivery' ? 0.55 : 0.30,
        ph === 'delivery' ? 0.10 : 1.00
      );

    /* ── Aros (toro) ──────────────────────────────────────────── */
    if (ph === 'flying') {
      rc.bindTorus();
      for (let i = 0; i < def.hoops.length; i++) {
        if (i < _mission.currentHoop) continue;
        const isNext = i === _mission.currentHoop;
        _drawRing(rc, def.hoops[i],
          isNext ? 1.00 : 0.40,
          isNext ? 0.85 : 0.40,
          isNext ? 0.00 : 0.60
        );
      }
    }

    /* ── Seta de waypoint ─────────────────────────────────────── */
    _drawWaypointArrow(rc);
  }

  /* ── API pública ──────────────────────────────────────────────── */
  function isDialogueBlocking() {
    return !!(_mission && _mission._acceptPending);
  }

  return {
    MISSION_DEFS,
    get state()      { return _mission; },
    get missionIdx() { return _missionIdx; },

    /** Chame após criar o objeto drone e antes do loop.
     *  @param {object} droneRef – referência ao objeto drone de game.js */
    init(droneRef) {
      _drone      = droneRef;
      _missionIdx = 0;
      _mission    = buildMissionState(0);
    },

    /** Atualiza lógica de missão. Chame a cada frame com dt em segundos. */
    update,

    isDialogueBlocking,

    /** Renderiza zonas, auras, aros e seta. Chame a cada frame.
     *  rc = { gl, loc, modelMat, normMat3, IDX_COUNT, DISC_COUNT,
     *         TOR_IDX_COUNT, bindMesh, bindDisc, bindTorus, frameTime } */
    draw,
  };
})();
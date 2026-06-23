/* ================================================================
   city.js – dados e renderização da cidade
   (prédios, árvores, props, colisões)
   ================================================================ */

const City = (() => {
  'use strict';

  /* ── Constantes de layout ─────────────────────────────────────── */
  const ROAD_HALF_MAIN  = 3.0;
  const ROAD_HALF_SEC   = 2.5;
  const SIDEWALK_W_MAIN = 2.2;
  const SIDEWALK_W_SEC  = 1.8;
  const PARK_CX = 24;
  const PARK_CZ = 24;
  const PARK_HW = 9.5;
  const PARK_HZ = 7.5;

  /* ── Prédios ──────────────────────────────────────────────────── */
  const buildings = [
    /* ── Quarteirão NE interno ── */
    [  9,  9, 4, 8,  8, 0.58, 0.56, 0.52],
    [ 15,  9, 5, 5, 12, 0.26, 0.38, 0.55],
    [  9, 15, 8, 3,  6, 0.70, 0.64, 0.50],
    [ 15, 15, 4, 4, 10, 0.54, 0.53, 0.54],
    /* ── Quarteirão NO interno ── */
    [ -9,  9, 4, 8, 10, 0.58, 0.40, 0.32],
    [-15,  9, 5, 5,  7, 0.56, 0.56, 0.54],
    [ -9, 15, 8, 3,  5, 0.72, 0.66, 0.52],
    [-15, 15, 4, 4, 14, 0.30, 0.36, 0.52],
    /* ── Quarteirão SE interno ── */
    [  9, -9, 4, 8,  9, 0.82, 0.80, 0.78],
    [ 15, -9, 5, 5,  6, 0.54, 0.53, 0.54],
    [  9,-15, 8, 3, 11, 0.28, 0.34, 0.50],
    [ 15,-15, 4, 4,  8, 0.62, 0.44, 0.34],
    /* ── Quarteirão SO interno ── */
    [ -9, -9, 4, 8,  7, 0.56, 0.56, 0.54],
    [-15, -9, 5, 5, 13, 0.26, 0.38, 0.55],
    [ -9,-15, 8, 3,  5, 0.68, 0.62, 0.48],
    [-15,-15, 4, 4,  9, 0.32, 0.38, 0.52],
    /* ── Quarteirão NE externo ── */
    [ 24, 10, 4, 9, 14, 0.26, 0.38, 0.55],
    [ 32, 10, 8, 4,  9, 0.60, 0.58, 0.55],
    [ 24, 18, 5, 5,  7, 0.70, 0.64, 0.50],
    [ 32, 22, 9, 4, 16, 0.30, 0.36, 0.52],
    [ 24, 30, 6, 6, 11, 0.58, 0.56, 0.54],
    [ 33, 30, 4, 8,  8, 0.62, 0.44, 0.34],
    /* ── Quarteirão NO externo ── */
    [-24, 10, 4, 9, 12, 0.30, 0.36, 0.52],
    [-32, 10, 8, 4, 18, 0.26, 0.38, 0.55],
    [-24, 20, 5, 5,  7, 0.58, 0.56, 0.54],
    [-32, 24, 9, 4, 10, 0.70, 0.64, 0.50],
    [-25, 32, 5, 6, 13, 0.82, 0.80, 0.78],
    [-34, 30, 4, 8,  8, 0.60, 0.42, 0.32],
    /* ── Quarteirão SE externo ── */
    [ 24,-10, 4, 9, 10, 0.58, 0.56, 0.54],
    [ 32,-12, 8, 4, 15, 0.28, 0.34, 0.50],
    [ 24,-20, 5, 5,  6, 0.70, 0.64, 0.50],
    [ 32,-28, 9, 4, 12, 0.82, 0.80, 0.78],
    [ 24,-33, 6, 6,  9, 0.58, 0.40, 0.32],
    [ 33,-33, 4, 8, 17, 0.26, 0.38, 0.55],
    /* ── Quarteirão SO externo ── */
    [-24,-10, 4, 9,  8, 0.60, 0.58, 0.55],
    [-32,-12, 8, 4, 14, 0.30, 0.36, 0.52],
    [-24,-22, 5, 5, 10, 0.64, 0.44, 0.34],
    [-32,-26, 9, 4,  7, 0.56, 0.56, 0.54],
    [-25,-33, 5, 6, 11, 0.70, 0.64, 0.50],
    [-34,-33, 4, 8, 16, 0.28, 0.34, 0.50],
    /* ── Torres marcantes espalhadas ── */
    [  0,  47, 7, 7, 22, 0.82, 0.80, 0.78],
    [ 47,   0, 5, 9, 28, 0.24, 0.34, 0.52],
    [-47,   0, 9, 5, 18, 0.60, 0.58, 0.55],
    [  0, -47, 6, 6, 20, 0.30, 0.36, 0.52],
    [ 47,  47, 5, 5, 15, 0.70, 0.64, 0.50],
    [-47,  47, 8, 4, 12, 0.58, 0.40, 0.32],
    [ 47, -47, 4, 8, 24, 0.26, 0.38, 0.55],
    [-47, -47, 5, 5, 19, 0.82, 0.80, 0.78],
    /* Mega-torre central */
    [  0,   0, 8, 8, 35, 0.20, 0.26, 0.40],
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
        b[0] = x; b[1] = z;
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

  /* ── Árvores ──────────────────────────────────────────────────── */
  let treeInstances = [];

  function _buildTreeInstances(missionDefs) {
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
        if (x > b[0]-b[2]/2-pad && x < b[0]+b[2]/2+pad &&
            z > b[1]-b[3]/2-pad && z < b[1]+b[3]/2+pad) return true;
      }
      return false;
    }
    function hitsMissionZones(x, z) {
      for (let mi = 0; mi < missionDefs.length; mi++) {
        const m = missionDefs[mi];
        const pdx = x - m.pickup.x, pdz = z - m.pickup.z;
        const ddx = x - m.delivery.x, ddz = z - m.delivery.z;
        if (Math.sqrt(pdx*pdx + pdz*pdz) < m.pickup.r + 1.8) return true;
        if (Math.sqrt(ddx*ddx + ddz*ddz) < m.delivery.r + 1.8) return true;
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
        const dx = x - out[i].x, dz = z - out[i].z;
        if (dx*dx + dz*dz < 20) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const scale = 0.11 + rand() * 0.13;
      out.push({ x, z, scale, rotY: rand() * Math.PI * 2, tint: 0.90 + rand() * 0.25 });
    }
    return out;
  }

  function _addTreesNearPark(instances) {
    const ring = [
      [-7.8, -5.4], [0.0, -5.8], [7.8, -5.4],
      [-8.2,  0.0],               [8.2,  0.0],
      [-7.8,  5.4], [0.0,  5.8], [7.8,  5.4],
      [-3.6, -6.6], [3.6, -6.6], [-3.6, 6.6], [3.6, 6.6],
    ];
    for (let i = 0; i < ring.length; i++) {
      const off = ring[i];
      instances.push({
        x: PARK_CX + off[0], z: PARK_CZ + off[1],
        scale: 0.10 + (i % 3) * 0.015,
        rotY: (i * 0.83) % (Math.PI * 2),
        tint: 0.95 + (i % 4) * 0.05,
      });
    }
  }

  /* ── Colisão ──────────────────────────────────────────────────── */
  const BUILDING_Y_MARGIN = 1.8;
  const TREE_Y_MARGIN = 8.0;

  function intersectsSquareAABB(px, pz, pHalf, ox, oz, oHalfX, oHalfZ) {
    return Math.abs(px - ox) <= (pHalf + oHalfX) &&
           Math.abs(pz - oz) <= (pHalf + oHalfZ);
  }
  function overlapsVertical(py, playerHalfHeight, objectTopY) {
    return (py + playerHalfHeight) >= 0.0 && (py - playerHalfHeight) <= objectTopY;
  }
  function overlapsYRange(py, playerHalfHeight, minY, maxY) {
    return (py + playerHalfHeight) >= minY && (py - playerHalfHeight) <= maxY;
  }
  function intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, cx, cz, halfX, halfZ, minY, maxY) {
    if (!overlapsYRange(py, playerHalfHeight, minY, maxY)) return false;
    return intersectsSquareAABB(px, pz, playerHalf, cx, cz, halfX, halfZ);
  }
  function checkBuildingCollision(px, pz, py, playerHalf, playerHalfHeight) {
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bx = b[0], bz = b[1], bw = b[2]*0.5, bd = b[3]*0.5, bh = b[4];
      let topY = bh + BUILDING_Y_MARGIN;
      if (bh >= 12) {
        const setH = bh * 0.36;
        topY = bh + setH;
        if (bh >= 20) topY = bh + setH + setH * 0.50;
        else topY += 1.4;
      } else if (bh >= 6) {
        topY = bh + 1.65;
      }
      topY += BUILDING_Y_MARGIN;
      if (!overlapsVertical(py, playerHalfHeight, topY)) continue;
      if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, bw, bd, 0.0, bh + BUILDING_Y_MARGIN)) return b;
      if (bh >= 10) {
        const podH = Math.min(bh * 0.16, 2.8);
        if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, bw+0.14, bd+0.14, 0.0, podH + BUILDING_Y_MARGIN)) return b;
      }
      if (bh >= 12) {
        const setH = bh * 0.36, sw = bw * 0.76, sd = bd * 0.76;
        const setMinY = bh, setMaxY = bh + setH;
        if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, sw, sd, setMinY, setMaxY + BUILDING_Y_MARGIN)) return b;
        if (bh >= 20) {
          const s2H = setH * 0.50, s2MinY = setMaxY, s2MaxY = setMaxY + s2H;
          if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, sw*0.70, sd*0.70, s2MinY, s2MaxY + BUILDING_Y_MARGIN)) return b;
        } else {
          const rtMinY = setMaxY, rtMaxY = setMaxY + 1.4;
          if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, sw*0.52, sd*0.52, rtMinY, rtMaxY + BUILDING_Y_MARGIN)) return b;
        }
      } else if (bh >= 6) {
        if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx, bz, bw+0.07, bd+0.07, bh+0.01, bh+0.47 + BUILDING_Y_MARGIN)) return b;
        if (intersectsPrism(px, pz, py, playerHalf, playerHalfHeight, bx+bw*0.20, bz-bd*0.18, bw*0.14, bd*0.14, bh+0.35, bh+1.65 + BUILDING_Y_MARGIN)) return b;
      }
    }
    return null;
  }
  function checkTreeCollision(px, pz, py, playerHalf, playerHalfHeight) {
    for (let i = 0; i < treeInstances.length; i++) {
      const t = treeInstances[i];
      const treeHalf = t.scale * 0.8;
      const treeHeight = t.scale * 11.0;
      if (!overlapsVertical(py, playerHalfHeight, treeHeight + TREE_Y_MARGIN)) continue;
      if (intersectsSquareAABB(px, pz, playerHalf, t.x, t.z, treeHalf, treeHalf)) return t;
    }
    return null;
  }

  /* Dimensões do Car.obj (escala 1:1, centro geométrico em local Z≈2.0) */
  const CAR_HALF_W = 0.7;   // meia-largura (eixo X local)
  const CAR_HALF_L = 2.2;   // meia-comprimento (eixo Z local)
  const CAR_OFS_Z  = 0.3;   // offset do centro geométrico no eixo Z local
  const CAR_HEIGHT = 1.6;   // altura do topo do carro em mundo

  function checkCarCollision(px, pz, py, playerHalf, playerHalfHeight) {
    if (py > CAR_HEIGHT + 1.2) return null;
    for (let i = 0; i < carInstances.length; i++) {
      const c = carInstances[i];
      const cosR = Math.cos(c.rotY);
      const sinR = Math.sin(c.rotY);
      /* Centro geométrico do carro em coordenadas de mundo */
      const cx = c.x + CAR_OFS_Z * sinR;
      const cz = c.z + CAR_OFS_Z * cosR;
      /* AABB do retângulo rotacionado (exato para qualquer ângulo) */
      const hx = CAR_HALF_W * Math.abs(cosR) + CAR_HALF_L * Math.abs(sinR);
      const hz = CAR_HALF_L * Math.abs(cosR) + CAR_HALF_W * Math.abs(sinR);
      if (intersectsSquareAABB(px, pz, playerHalf, cx, cz, hx, hz)) return c;
    }
    return null;
  }

  function resolveCollision(posArray, oldPos, playerHalf, playerHalfHeight) {
    const py = posArray[1];
    let hitX = false, hitZ = false;
    if (checkBuildingCollision(posArray[0], oldPos[2], py, playerHalf, playerHalfHeight) ||
        checkTreeCollision(posArray[0], oldPos[2], py, playerHalf, playerHalfHeight) ||
        checkCarCollision(posArray[0], oldPos[2], py, playerHalf, playerHalfHeight)) {
      posArray[0] = oldPos[0]; hitX = true;
    }
    if (checkBuildingCollision(posArray[0], posArray[2], py, playerHalf, playerHalfHeight) ||
        checkTreeCollision(posArray[0], posArray[2], py, playerHalf, playerHalfHeight) ||
        checkCarCollision(posArray[0], posArray[2], py, playerHalf, playerHalfHeight)) {
      posArray[2] = oldPos[2]; hitZ = true;
    }
    return { hitX, hitZ, hitAny: hitX || hitZ };
  }

  /* ── Props da cidade ──────────────────────────────────────────── */
  function buildCityProps() {
    const props = [];
    const mainSide = ROAD_HALF_MAIN + SIDEWALK_W_MAIN * 0.52;
    const secSide  = ROAD_HALF_SEC + SIDEWALK_W_SEC * 0.52;
    function pushLamp(x, z, rotY)           { props.push({ type: 'lamp',     x, z, rotY }); }
    function pushHydrant(x, z)              { props.push({ type: 'hydrant',  x, z, rotY: 0 }); }
    function pushUtility(x, z, rotY, sx, sz){ props.push({ type: 'utility',  x, z, rotY, sx, sz }); }

    for (let k = -120; k <= 120; k += 24) {
      if (Math.abs(k) < 10) continue;
      if (Math.abs(k - PARK_CX) < PARK_HW + 3.0) continue;
      pushLamp(k,  mainSide, Math.PI * 0.5);
      pushLamp(k, -mainSide, -Math.PI * 0.5);
      pushLamp( mainSide, k, Math.PI);
      pushLamp(-mainSide, k, 0.0);
    }
    for (let k = -120; k <= 120; k += 30) {
      if (Math.abs(k) < 8) continue;
      pushLamp(k,  40+secSide, Math.PI*0.5); pushLamp(k,  40-secSide, -Math.PI*0.5);
      pushLamp(k, -40+secSide, Math.PI*0.5); pushLamp(k, -40-secSide, -Math.PI*0.5);
      pushLamp( 40+secSide, k, Math.PI);     pushLamp( 40-secSide, k, 0.0);
      pushLamp(-40+secSide, k, Math.PI);     pushLamp(-40-secSide, k, 0.0);
    }
    const hydrants = [
      [8,8],[-8,8],[8,-8],[-8,-8],[32,8],[48,8],[32,-8],[48,-8],
      [-32,8],[-48,8],[-32,-8],[-48,-8],[8,32],[-8,32],[8,48],[-8,48],
      [8,-32],[-8,-32],[8,-48],[-8,-48],
    ];
    for (let i = 0; i < hydrants.length; i++) pushHydrant(hydrants[i][0], hydrants[i][1]);
    pushUtility( 54,  18, 0.0, 2.4, 1.6); pushUtility( 54, -18, 0.0, 2.2, 1.5);
    pushUtility(-54,  18, 0.0, 2.4, 1.6); pushUtility(-54, -18, 0.0, 2.2, 1.5);
    pushUtility( 18,  54, Math.PI*0.5, 2.5, 1.7); pushUtility(-18,  54, Math.PI*0.5, 2.3, 1.5);
    pushUtility( 18, -54, Math.PI*0.5, 2.5, 1.7); pushUtility(-18, -54, Math.PI*0.5, 2.3, 1.5);
    return props;
  }
  const cityProps = buildCityProps();

  function buildCarInstances() {
    const out = [];
    const COLORS = [
      [0.72, 0.72, 0.74], [0.60, 0.12, 0.12], [0.15, 0.25, 0.56],
      [0.78, 0.74, 0.60], [0.20, 0.38, 0.22], [0.65, 0.55, 0.12],
      [0.26, 0.26, 0.28], [0.66, 0.30, 0.14],
    ];
    let ci = 0;
    function car(x, z, rotY) {
      const c = COLORS[ci++ % COLORS.length];
      out.push({ x, z, rotY, r: c[0], g: c[1], b: c[2] });
    }
    /* Via E-O principal (z ≈ 0)  */
    for (const x of [-65, -22, 16, 65]) car(x,  2.2,  Math.PI / 2);
    for (const x of [-55, -14, 26, 72]) car(x, -2.2, -Math.PI / 2);
    /* Via N-S principal (x ≈ 0)  */
    for (const z of [-65, -22, 16, 65]) car( 2.2, z,           0);
    for (const z of [-55, -14, 26, 72]) car(-2.2, z,     Math.PI);
    /* Via secundária E-O z = +40 */
    for (const x of [-65, -22, 12, 65]) car(x,  42.2,  Math.PI / 2);
    for (const x of [-55, -12, 26, 70]) car(x,  37.8, -Math.PI / 2);
    /* Via secundária E-O z = −40 */
    for (const x of [-65, -22, 12, 65]) car(x, -37.8,  Math.PI / 2);
    for (const x of [-55, -12, 26, 70]) car(x, -42.2, -Math.PI / 2);
    /* Via secundária N-S x = +40 */
    for (const z of [-65, -22, 16, 65]) car( 42.2, z,           0);
    for (const z of [-55, -14, 26, 70]) car( 37.8, z,     Math.PI);
    /* Via secundária N-S x = −40 */
    for (const z of [-65, -22, 16, 65]) car(-37.8, z,           0);
    for (const z of [-55, -14, 26, 70]) car(-42.2, z,     Math.PI);
    return out;
  }
  const carInstances = buildCarInstances();

  /* ── LOD ──────────────────────────────────────────────────────── */
  const BUILDING_SIMPLIFY_DIST2 = 95 * 95;
  const BUILDING_CULL_DIST2     = 170 * 170;
  const WINDOW_LIGHT_CULL_DIST2 = 115 * 115;
  const TREE_FULL_DIST2         = 80 * 80;
  const TREE_HALF_DIST2         = 130 * 130;
  const TREE_CULL_DIST2         = 180 * 180;
  const PROP_CULL_DIST2         = 155 * 155;
  const PROP_SIMPLIFY_DIST2     = 95 * 95;
  const PROP_SPARSIFY_DIST2     = 120 * 120;
  const CAR_CULL_DIST2  = 130 * 130;

  /* ── Dados de janelas ─────────────────────────────────────────── */
  const buildingWindowData = (function () {
    function addFaceWindows(wins, cx, cz, fw, fd, yBase, blockH, wtype) {
      const rows = Math.min(Math.max(1, Math.floor(blockH / 4.5)), 5);
      const ncX  = Math.min(2, Math.max(1, Math.floor(fw / 2.8)));
      const ncZ  = Math.min(2, Math.max(1, Math.floor(fd / 2.8)));
      const T    = 0.018;
      for (let row = 0; row < rows; row++) {
        const wy = yBase + 1.2 + (row + 0.5) * ((blockH - 1.2) / rows);
        for (let col = 0; col < ncZ; col++) {
          const t = ncZ > 1 ? col / (ncZ - 1) : 0.5;
          const wz = cz + (t - 0.5) * fd * 0.66;
          const wsz = Math.min(fd * 0.55 / ncZ, 1.20);
          const off = fw / 2 + T;
          wins.push({ px: cx+off, py: wy, pz: wz, sx: T, sy: 0.80, sz: wsz, warm: wtype, nx:  1, nz: 0 });
          wins.push({ px: cx-off, py: wy, pz: wz, sx: T, sy: 0.80, sz: wsz, warm: wtype, nx: -1, nz: 0 });
        }
        for (let col = 0; col < ncX; col++) {
          const t = ncX > 1 ? col / (ncX - 1) : 0.5;
          const wx = cx + (t - 0.5) * fw * 0.66;
          const wsx = Math.min(fw * 0.55 / ncX, 1.20);
          const off = fd / 2 + T;
          wins.push({ px: wx, py: wy, pz: cz+off, sx: wsx, sy: 0.80, sz: T, warm: wtype, nx: 0, nz:  1 });
          wins.push({ px: wx, py: wy, pz: cz-off, sx: wsx, sy: 0.80, sz: T, warm: wtype, nx: 0, nz: -1 });
        }
      }
    }
    return buildings.map(function (b, bi) {
      const bx = b[0], bz = b[1], bw = b[2], bd = b[3], bh = b[4];
      if (bh < 5) return [];
      const warm = (bi * 17 + 3) % 3;
      const wins = [];
      addFaceWindows(wins, bx, bz, bw, bd, 0, bh, warm);
      if (bh >= 12) {
        const setH = bh * 0.36, sw = bw * 0.76, sd = bd * 0.76;
        addFaceWindows(wins, bx, bz, sw, sd, bh, setH, warm);
        if (bh >= 20) {
          const s2H = setH * 0.50, s2Y = bh + setH;
          addFaceWindows(wins, bx, bz, sw*0.70, sd*0.70, s2Y, s2H, warm);
          const beaconY = bh * 1.60 + 2.94;
          wins.push({ px: bx, py: beaconY, pz: bz, sx: 0.26, sy: 0.26, sz: 0.26, warm: 3, nx: 0, nz: 0 });
        }
      }
      return wins;
    });
  })();

  /* ── Funções de desenho ───────────────────────────────────────── */

  function drawBuildings(rc, nightBlend) {
    const { gl, loc, modelMat, normMat3, camPos, IDX_COUNT, bindMesh } = rc;
    bindMesh();
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bx=b[0], bz=b[1], bw=b[2], bd=b[3], bh=b[4], br=b[5], bg=b[6], bb=b[7];
      const dx = bx - camPos[0], dz = bz - camPos[2];
      const d2 = dx*dx + dz*dz;
      if (d2 > BUILDING_CULL_DIST2) continue;
      const simplified = d2 > BUILDING_SIMPLIFY_DIST2;

      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [bx, bh/2, bz]);
      mat4.scale(modelMat, modelMat, [bw, bh, bd]);
      _drawBox(rc, br, bg, bb);

      if (!simplified && bh >= 10) {
        const podH = Math.min(bh * 0.16, 2.8);
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, podH/2, bz]);
        mat4.scale(modelMat, modelMat, [bw+0.28, podH, bd+0.28]);
        _drawBox(rc, br*0.76, bg*0.76, bb*0.76);
      }
      if (!simplified && bh >= 7) {
        const numBands = Math.min(Math.floor(bh / 3.2) - 1, 7);
        if (numBands > 0) {
          const bandStep = bh / (numBands + 1);
          const lr=Math.min(br*1.16,1), lg=Math.min(bg*1.16,1), lb=Math.min(bb*1.16,1);
          for (let f = 1; f <= numBands; f++) {
            mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, f*bandStep, bz]);
            mat4.scale(modelMat, modelMat, [bw+0.06, 0.22, bd+0.06]);
            _drawBox(rc, lr, lg, lb);
          }
        }
      }
      if (!simplified && bh >= 12) {
        const setH=bh*0.36, setY=bh+setH/2, sw=bw*0.76, sd=bd*0.76;
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, setY, bz]);
        mat4.scale(modelMat, modelMat, [sw, setH, sd]);
        _drawBox(rc, Math.min(br*1.08,1), Math.min(bg*1.08,1), Math.min(bb*1.08,1));
        if (bh >= 20) {
          const s2H=setH*0.50, s2Y=setY+setH/2+s2H/2;
          mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, s2Y, bz]);
          mat4.scale(modelMat, modelMat, [sw*0.70, s2H, sd*0.70]);
          _drawBox(rc, Math.min(br*1.16,1), Math.min(bg*1.16,1), Math.min(bb*1.16,1));
          const antBase=s2Y+s2H/2, antH=2.8+bh*0.06;
          mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, antBase+antH/2, bz]);
          mat4.scale(modelMat, modelMat, [0.14, antH, 0.14]); _drawBox(rc, 0.62, 0.62, 0.66);
          mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, antBase+antH+0.14, bz]);
          mat4.scale(modelMat, modelMat, [0.24, 0.24, 0.24]); _drawBox(rc, 0.30, 0.10, 0.10);
        } else {
          const rtH=1.4, rtY=setY+setH/2+rtH/2;
          mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, rtY, bz]);
          mat4.scale(modelMat, modelMat, [sw*0.52, rtH, sd*0.52]);
          _drawBox(rc, Math.min(br*1.22,1), Math.min(bg*1.22,1), Math.min(bb*1.22,1));
        }
      } else if (!simplified && bh >= 6) {
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, bh+0.24, bz]);
        mat4.scale(modelMat, modelMat, [bw+0.14, 0.46, bd+0.14]);
        _drawBox(rc, Math.min(br*1.12,1), Math.min(bg*1.12,1), Math.min(bb*1.12,1));
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx+bw*0.20, bh+1.0, bz-bd*0.18]);
        mat4.scale(modelMat, modelMat, [bw*0.28, 1.3, bd*0.28]);
        _drawBox(rc, Math.min(br*0.90,1), Math.min(bg*0.90,1), Math.min(bb*0.90,1));
      }

      const wins = buildingWindowData[i];
      if (!simplified && wins) {
        gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
        for (let wi = 0; wi < wins.length; wi++) {
          const w = wins[wi];
          if (w.warm === 3) continue;
          if (nightBlend >= 0.04 && ((i*13 + wi*7) % 100) <= 62) continue;
          mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [w.px, w.py, w.pz]);
          mat4.scale(modelMat, modelMat, [w.sx, w.sy, w.sz]);
          _drawBox(rc, 0.09, 0.11, 0.17);
        }
        gl.disable(gl.POLYGON_OFFSET_FILL);
      }
    }
  }

  function _beaconBlink(t) {
    const c = t % 4.2;
    if (c < 0.18) return 1.0;
    if (c < 0.45) return 0.0;
    if (c < 0.63) return 1.0;
    if (c < 0.90) return 0.0;
    if (c < 1.08) return 1.0;
    return 0.0;
  }

  function drawBuildingLights(rc, frameTime, nightBlend) {
    if (nightBlend < 0.04) return;
    const { gl, loc, modelMat, camPos, bindMesh } = rc;
    bindMesh();
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    for (let bi = 0; bi < buildingWindowData.length; bi++) {
      const b = buildings[bi];
      if (b) {
        const dx = b[0] - camPos[0], dz = b[1] - camPos[2];
        if (dx*dx + dz*dz > WINDOW_LIGHT_CULL_DIST2) continue;
      }
      const wins = buildingWindowData[bi];
      for (let wi = 0; wi < wins.length; wi++) {
        const w = wins[wi];
        if (w.warm !== 3 && ((bi*13 + wi*7) % 100) > 62) continue;
        const em = nightBlend * 0.90;
        let er, eg, eb;
        if      (w.warm === 0) { er=1.00*em; eg=0.78*em; eb=0.26*em; }
        else if (w.warm === 1) { er=0.95*em; eg=0.90*em; eb=0.65*em; }
        else if (w.warm === 2) { er=0.50*em; eg=0.68*em; eb=1.00*em; }
        else {
          const blink = _beaconBlink(frameTime);
          er=1.00*blink; eg=0.08*blink; eb=0.08*blink;
        }
        gl.uniform3f(loc.uEmissive, er, eg, eb);
        mat4.identity(modelMat);
        mat4.translate(modelMat, modelMat, [w.px, w.py, w.pz]);
        mat4.scale(modelMat, modelMat, [w.sx, w.sy, w.sz]);
        _drawBox(rc, 0.09, 0.11, 0.17);
      }
    }
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }

  function drawTrees(rc, frameTime, nightBlend) {
    const { gl, loc, modelMat, normMat3, camPos, treeMesh } = rc;
    if (!treeMesh || treeInstances.length === 0) return;
    bindOBJMesh(gl, loc, treeMesh);
    gl.uniform1f(loc.uSpecular, 0.08);
    gl.uniform1f(loc.uTreeMode, 1.0);
    for (let i = 0; i < treeInstances.length; i++) {
      const t = treeInstances[i];
      const dx = t.x - camPos[0], dz = t.z - camPos[2];
      const d2 = dx*dx + dz*dz;
      if (d2 > TREE_CULL_DIST2) continue;
      if (d2 > TREE_HALF_DIST2 && (i % 2) !== 0) continue;
      if (d2 > TREE_FULL_DIST2 && d2 <= TREE_HALF_DIST2 && (i % 3) === 1) continue;
      const s = t.scale, e = nightBlend * 0.02, baseY = 0.75 * s;
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [t.x, baseY, t.z]);
      mat4.rotateY(modelMat, modelMat, t.rotY);
      mat4.scale(modelMat, modelMat, [s, s, s]);
      gl.uniformMatrix4fv(loc.uModel, false, modelMat);
      mat3.normalFromMat4(normMat3, modelMat);
      gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
      gl.uniform1f(loc.uTreeTrunkTop, baseY + 7.6 * s);
      gl.uniform3f(loc.uEmissive, e*0.20, e*0.32, e*0.08);
      gl.uniform3f(loc.uColor, 0.17*t.tint, 0.45*t.tint, 0.17*t.tint);
      drawOBJMesh(gl, treeMesh);
    }
    gl.uniform1f(loc.uTreeMode, 0.0);
    gl.uniform1f(loc.uTreeTrunkTop, 0.0);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    gl.uniform1f(loc.uSpecular, 1.0);
  }

  function drawPark(rc, frameTime, nightBlend) {
    const { gl, loc, modelMat, IDX_COUNT, DISC_COUNT, bindMesh, bindDisc } = rc;
    bindMesh();
    mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [PARK_CX, 0.03, PARK_CZ]);
    mat4.scale(modelMat, modelMat, [PARK_HW*2, 0.06, PARK_HZ*2]); _drawBox(rc, 0.68, 0.68, 0.64);
    mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [PARK_CX, 0.055, PARK_CZ]);
    mat4.scale(modelMat, modelMat, [PARK_HW*1.7, 0.03, PARK_HZ*1.6]); _drawBox(rc, 0.30, 0.52, 0.24);

    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(loc.uAlpha, 0.78);
    gl.uniform3f(loc.uEmissive, 0.03+nightBlend*0.05, 0.07+nightBlend*0.06, 0.10+nightBlend*0.08);
    mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [PARK_CX, 0.095, PARK_CZ]);
    mat4.scale(modelMat, modelMat, [PARK_HW*0.9, 0.04, PARK_HZ*0.55]); _drawBox(rc, 0.22, 0.45, 0.62);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0); gl.uniform1f(loc.uAlpha, 1.0);
    gl.depthMask(true); gl.disable(gl.BLEND);

    const benches = [
      [PARK_CX-4.2, PARK_CZ-2.6, 0.0], [PARK_CX-4.2, PARK_CZ+2.6, 0.0],
      [PARK_CX+4.2, PARK_CZ-2.6, Math.PI], [PARK_CX+4.2, PARK_CZ+2.6, Math.PI],
    ];
    for (let i = 0; i < benches.length; i++) {
      const bx=benches[i][0], bz=benches[i][1], by=benches[i][2];
      mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, 0.22, bz]);
      mat4.rotateY(modelMat, modelMat, by); mat4.scale(modelMat, modelMat, [1.7, 0.12, 0.42]);
      _drawBox(rc, 0.43, 0.30, 0.18);
      mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx, 0.47, bz+(by===0.0?-0.18:0.18)]);
      mat4.rotateY(modelMat, modelMat, by); mat4.scale(modelMat, modelMat, [1.7, 0.34, 0.12]);
      _drawBox(rc, 0.40, 0.28, 0.16);
      for (const lx of [-0.6, 0.6]) {
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [bx+lx, 0.10, bz]);
        mat4.scale(modelMat, modelMat, [0.10, 0.20, 0.10]); _drawBox(rc, 0.24, 0.24, 0.26);
      }
    }
    for (const sz of [-1, 1]) {
      mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [PARK_CX, 0.12, PARK_CZ+sz*(PARK_HZ-0.35)]);
      mat4.scale(modelMat, modelMat, [PARK_HW*1.95, 0.18, 0.18]); _drawBox(rc, 0.55, 0.55, 0.52);
    }
    for (const sx of [-1, 1]) {
      mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [PARK_CX+sx*(PARK_HW-0.35), 0.12, PARK_CZ]);
      mat4.scale(modelMat, modelMat, [0.18, 0.18, PARK_HZ*1.95]); _drawBox(rc, 0.55, 0.55, 0.52);
    }
  }

  function drawCityProps(rc, nightBlend) {
    const { gl, loc, modelMat, camPos, bindMesh } = rc;
    bindMesh();
    for (let i = 0; i < cityProps.length; i++) {
      const p = cityProps[i];
      const dx = p.x - camPos[0], dz = p.z - camPos[2];
      const d2 = dx*dx + dz*dz;
      if (d2 > PROP_CULL_DIST2) continue;
      if (d2 > PROP_SPARSIFY_DIST2 && (i % 2) !== 0) continue;
      const simplified = d2 > PROP_SIMPLIFY_DIST2;

      if (p.type === 'lamp') {
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [p.x, 0.10, p.z]);
        mat4.scale(modelMat, modelMat, [0.26, 0.20, 0.26]); _drawBox(rc, 0.26, 0.26, 0.28);
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [p.x, 2.0, p.z]);
        mat4.scale(modelMat, modelMat, [0.08, 3.8, 0.08]); _drawBox(rc, 0.34, 0.34, 0.36);
        if (!simplified) {
          mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [p.x, 3.86, p.z]);
          mat4.rotateY(modelMat, modelMat, p.rotY); mat4.translate(modelMat, modelMat, [0.38, 0.0, 0.0]);
          mat4.scale(modelMat, modelMat, [0.76, 0.06, 0.06]); _drawBox(rc, 0.36, 0.36, 0.38);
        }
        const lx = p.x + Math.cos(p.rotY)*0.78, lz = p.z - Math.sin(p.rotY)*0.78;
        const le = nightBlend * (simplified ? 0.30 : 0.52);
        gl.uniform3f(loc.uEmissive, le*1.0, le*0.84, le*0.52);
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [lx, 3.72, lz]);
        mat4.scale(modelMat, modelMat, simplified ? [0.12,0.10,0.12] : [0.16,0.12,0.16]);
        _drawBox(rc, 0.96, 0.84, 0.52);
        gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
      } else if (p.type === 'hydrant') {
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [p.x, 0.16, p.z]);
        mat4.scale(modelMat, modelMat, [0.20, 0.32, 0.20]); _drawBox(rc, 0.78, 0.08, 0.08);
        if (!simplified) {
          mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [p.x, 0.42, p.z]);
          mat4.scale(modelMat, modelMat, [0.12, 0.20, 0.12]); _drawBox(rc, 0.82, 0.12, 0.12);
          for (const s of [-1, 1]) {
            mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [p.x+s*0.14, 0.25, p.z]);
            mat4.scale(modelMat, modelMat, [0.08, 0.10, 0.08]); _drawBox(rc, 0.74, 0.08, 0.08);
          }
        }
      } else if (p.type === 'utility') {
        const sx = p.sx || 2.2, sz = p.sz || 1.4;
        mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [p.x, 0.65, p.z]);
        mat4.rotateY(modelMat, modelMat, p.rotY||0); mat4.scale(modelMat, modelMat, [sx, 1.3, sz]);
        _drawBox(rc, 0.50, 0.52, 0.56);
        if (!simplified) {
          mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [p.x, 1.35, p.z]);
          mat4.rotateY(modelMat, modelMat, p.rotY||0); mat4.scale(modelMat, modelMat, [sx*1.05, 0.10, sz*1.05]);
          _drawBox(rc, 0.42, 0.44, 0.48);
          mat4.identity(modelMat); mat4.translate(modelMat, modelMat, [p.x, 0.65, p.z]);
          mat4.rotateY(modelMat, modelMat, p.rotY||0); mat4.translate(modelMat, modelMat, [0, 0, sz*0.50+0.03]);
          mat4.scale(modelMat, modelMat, [sx*0.62, 0.85, 0.04]); _drawBox(rc, 0.30, 0.33, 0.37);
        }
      }
    }
  }

  function drawCars(rc) {
    const { gl, loc, modelMat, normMat3, camPos } = rc;
    const cm = rc.carMesh;
    if (!cm) return;

    const MAT = {
      Body   : null,
      Black  : [0.01, 0.01, 0.01, 0.0, 0.0, 0.0, 0.0],
      Bottom : [0.02, 0.02, 0.02, 0.0, 0.0, 0.0, 0.0],
      Bumpers: [0.06, 0.06, 0.06, 0.0, 0.0, 0.0, 0.0],
      Lights : [1.0,  1.0,  0.9,  0.0, 0.3, 0.3, 0.2],
      Tires  : [0.05, 0.05, 0.05, 0.3, 0.0, 0.0, 0.0],
      Wheels : [0.49, 0.49, 0.49, 0.6, 0.0, 0.0, 0.0],
      Window : [0.04, 0.06, 0.10, 0.8, 0.0, 0.0, 0.0],
    };

    const segs = (cm.segments && cm.segments.length > 0) ? cm.segments : null;

    for (const c of carInstances) {
      const dx = c.x - camPos[0], dz = c.z - camPos[2];
      if (dx*dx + dz*dz > CAR_CULL_DIST2) continue;

      bindOBJMesh(gl, loc, cm);
      mat4.identity(modelMat);
      mat4.translate(modelMat, modelMat, [c.x, 0, c.z]);
      mat4.rotateY(modelMat, modelMat, c.rotY);
      gl.uniformMatrix4fv(loc.uModel, false, modelMat);
      mat3.normalFromMat4(normMat3, modelMat);
      gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
      gl.uniform1f(loc.uAlpha, 1.0);

      if (segs) {
        for (const seg of segs) {
          const m = Object.prototype.hasOwnProperty.call(MAT, seg.material) ? MAT[seg.material] : null;
          if (m === null) {
            gl.uniform3f(loc.uColor, c.r, c.g, c.b);
            gl.uniform1f(loc.uSpecular, 0.5);
            gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
          } else {
            gl.uniform3f(loc.uColor, m[0], m[1], m[2]);
            gl.uniform1f(loc.uSpecular, m[3]);
            gl.uniform3f(loc.uEmissive, m[4], m[5], m[6]);
          }
          gl.drawArrays(gl.TRIANGLES, seg.start, seg.count);
        }
      } else {
        gl.uniform3f(loc.uColor, c.r, c.g, c.b);
        gl.uniform1f(loc.uSpecular, 0.0);
        gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
        drawOBJMesh(gl, cm);
      }
    }

    gl.uniform1f(loc.uSpecular, 0.0);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    rc.bindMesh();
  }

  /* ── Helper interno ───────────────────────────────────────────── */
  function _drawBox(rc, r, g, b) {
    const { gl, loc, modelMat, normMat3, IDX_COUNT } = rc;
    gl.uniformMatrix4fv(loc.uModel, false, modelMat);
    mat3.normalFromMat4(normMat3, modelMat);
    gl.uniformMatrix3fv(loc.uNormalMat, false, normMat3);
    gl.uniform3f(loc.uColor, r, g, b);
    gl.drawElements(gl.TRIANGLES, IDX_COUNT, gl.UNSIGNED_SHORT, 0);
  }

  /* ── API pública ──────────────────────────────────────────────── */
  return {
    buildings,
    get treeInstances() { return treeInstances; },
    cityProps,
    buildingWindowData,
    ROAD_HALF_MAIN, ROAD_HALF_SEC, SIDEWALK_W_MAIN, SIDEWALK_W_SEC,
    PARK_CX, PARK_CZ, PARK_HW, PARK_HZ,
    buildTrees(missionDefs) {
      treeInstances = _buildTreeInstances(missionDefs);
      _addTreesNearPark(treeInstances);
    },
    resolveCollision,
    drawBuildings,
    drawBuildingLights,
    drawTrees,
    drawPark,
    drawCityProps,
    drawCars,
  };
})();
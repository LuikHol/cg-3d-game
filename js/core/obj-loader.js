/*
  obj-loader.js
  Parser OBJ customizado e upload das geometrias para a GPU.
  Suporta v/vn/vt, triangulação em leque, normais flat como fallback, e segmentos por material.
  API: parseOBJ, parseOBJGroups, loadOBJ, uploadOBJMesh, bindOBJMesh, drawOBJMesh.
*/

'use strict';

/* ── parseOBJ ─────────────────────────────────────────────────────
 * Converte texto OBJ em arrays interleaved prontos para a GPU.
 *
 * Tokens suportados:
 *   v   x y z          — posições de vértice
 *   vn  x y z          — normais de vértice
 *   vt  u v            — coordenadas de textura
 *   f   v/vt/vn ...    — faces (triangulação em leque)
 *   #, o, g, s, mtl*  — ignorados
 *
 * Variações do índice de face aceitas:
 *   v    v/vt    v//vn    v/vt/vn
 *
 * Índices negativos (relativos) também são tratados.
 * Se não houver normal, uma normal plana é gerada por triângulo.
 * Retorna arrays Float32Array não-indexados para gl.drawArrays.
 * ─────────────────────────────────────────────────────────────── */
function parseOBJ(text) {
  /* Acumuladores de dados brutos */
  const vPos  = [];   // [[x,y,z], ...]
  const vNorm = [];   // [[x,y,z], ...]
  const vTex  = [];   // [[u,v],   ...]

  /* Saída (flat, não-indexada) */
  const outPos  = [];
  const outNorm = [];
  const outUV   = [];

  /* Rastreamento de segmentos por material (usemtl) */
  const rawSegments = [];
  let segMaterial   = null;
  let segStart      = 0;

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line[0] === '#') continue;

    const parts = line.split(/\s+/);
    const tok   = parts[0];

    if (tok === 'v') {
      vPos.push([
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3]),
      ]);

    } else if (tok === 'vn') {
      vNorm.push([
        parseFloat(parts[1]),
        parseFloat(parts[2]),
        parseFloat(parts[3]),
      ]);

    } else if (tok === 'vt') {
      vTex.push([
        parseFloat(parts[1]),
        parseFloat(parts[2] !== undefined ? parts[2] : '0'),
      ]);

    } else if (tok === 'f') {
      // vértices da face
      const fverts = [];
      for (let k = 1; k < parts.length; k++) {
        if (!parts[k]) continue;
        const idx = parts[k].split('/');

        // OBJ usa índices 1-based; negativos = relativo ao fim
        function resolve(raw, arr) {
          if (!raw || raw === '') return -1;
          const n = parseInt(raw);
          return n < 0 ? arr.length + n : n - 1;
        }

        const pi = resolve(idx[0], vPos);
        const ti = resolve(idx[1], vTex);
        const ni = resolve(idx[2], vNorm);
        fverts.push({ pi, ti, ni });
      }

      // triangulação em leque
      for (let k = 1; k + 1 < fverts.length; k++) {
        const tri = [fverts[0], fverts[k], fverts[k + 1]];

        // normal flat como fallback caso o OBJ não tenha vn
        let flatNorm = null;
        if (tri[0].ni < 0 || tri[1].ni < 0 || tri[2].ni < 0) {
          const a = vPos[tri[0].pi];
          const b = vPos[tri[1].pi];
          const c = vPos[tri[2].pi];
          const e1x = b[0]-a[0], e1y = b[1]-a[1], e1z = b[2]-a[2];
          const e2x = c[0]-a[0], e2y = c[1]-a[1], e2z = c[2]-a[2];
          const nx = e1y*e2z - e1z*e2y;
          const ny = e1z*e2x - e1x*e2z;
          const nz = e1x*e2y - e1y*e2x;
          const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
          flatNorm = [nx/len, ny/len, nz/len];
        }

        // emite 3 vértices por triângulo
        for (let v = 0; v < 3; v++) {
          const { pi, ti, ni } = tri[v];

          const p = vPos[pi];
          outPos.push(p[0], p[1], p[2]);

          const n = (ni >= 0 && vNorm[ni]) ? vNorm[ni] : flatNorm;
          outNorm.push(n[0], n[1], n[2]);

          if (ti >= 0 && vTex[ti]) {
            outUV.push(vTex[ti][0], vTex[ti][1]);
          } else {
            outUV.push(0.0, 0.0);
          }
        }
      }
    } else if (tok === 'usemtl') {
      // inicia novo segmento de material
      const currCount = outPos.length / 3;
      const segCount = currCount - segStart;
      if (segCount > 0) {
        rawSegments.push({ material: segMaterial, start: segStart, count: segCount });
      }
      segMaterial = parts.slice(1).join(' ') || null;
      segStart = currCount;
    }
    /* tokens desconhecidos são ignorados */
  }

  // flush do segmento final
  const _lastCnt = outPos.length / 3 - segStart;
  if (_lastCnt > 0) rawSegments.push({ material: segMaterial, start: segStart, count: _lastCnt });

  return {
    positions   : new Float32Array(outPos),
    normals     : new Float32Array(outNorm),
    uvs         : new Float32Array(outUV),
    count       : outPos.length / 3,
    rawSegments,
  };
}

// igual ao parseOBJ, mas retorna { nome: parsedData } por objeto "o" no arquivo
function parseOBJGroups(text) {
  // divide o texto em blocos por "o <nome>"
  const sections = [];
  let current = { name: '_default', lines: [] };
  const lines = text.split('\n');

  // acumula declarações globais v/vn/vt antes do primeiro "o"
  const globalLines = [];
  let firstO = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const parts = line.split(/\s+/);
    if (parts[0] === 'o') {
      if (!firstO) firstO = true;
      sections.push(current);
      current = { name: parts.slice(1).join(' ') || '_default', lines: [] };
    } else {
      if (!firstO && (parts[0] === 'v' || parts[0] === 'vn' || parts[0] === 'vt')) {
        globalLines.push(line);
      }
      current.lines.push(line);
    }
  }
  sections.push(current);

  const result = {};
  for (const sec of sections) {
    if (sec.lines.length === 0) continue;
    // injeta as declarações globais antes das faces de cada seção
    const merged = globalLines.concat(sec.lines).join('\n');
    const parsed = parseOBJ(merged);
    if (parsed.count > 0) {
      // mescla se já existe um grupo com esse nome
      if (result[sec.name]) {
        const a = result[sec.name];
        result[sec.name] = {
          positions: _concatF32(a.positions, parsed.positions),
          normals:   _concatF32(a.normals,   parsed.normals),
          uvs:       _concatF32(a.uvs,       parsed.uvs),
          count:     a.count + parsed.count,
        };
      } else {
        result[sec.name] = parsed;
      }
    }
  }
  return result;
}

// auxiliar: concatena dois Float32Array
function _concatF32(a, b) {
  const out = new Float32Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// faz fetch de um .obj e retorna Promise<parsed>
function loadOBJ(url) {
  return fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error('OBJ load failed: ' + url + ' (HTTP ' + r.status + ')');
      return r.text();
    })
    .then(function (text) {
      return parseOBJ(text);
    });
}

// envia arrays parseados para a GPU; retorna mesh { posVBO, normVBO, uvVBO, count }
function uploadOBJMesh(gl, parsed) {
  const posVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posVBO);
  gl.bufferData(gl.ARRAY_BUFFER, parsed.positions, gl.STATIC_DRAW);

  const normVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normVBO);
  gl.bufferData(gl.ARRAY_BUFFER, parsed.normals, gl.STATIC_DRAW);

  const uvVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvVBO);
  gl.bufferData(gl.ARRAY_BUFFER, parsed.uvs, gl.STATIC_DRAW);

  return { posVBO, normVBO, uvVBO, count: parsed.count, segments: parsed.rawSegments || [] };
}

// vincula pos e norm ao shader; chame antes de drawOBJMesh
function bindOBJMesh(gl, loc, mesh) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posVBO);
  gl.enableVertexAttribArray(loc.aPos);
  gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normVBO);
  gl.enableVertexAttribArray(loc.aNorm);
  gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 0, 0);
}

// emite o draw call; chame bindOBJMesh antes
function drawOBJMesh(gl, mesh) {
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}

/* ================================================================
   obj-loader.js – parser OBJ próprio + upload para a GPU

   API pública (globais):
     parseOBJ(text)              → { positions, normals, uvs, count }
     loadOBJ(url)                → Promise<parsed>
     uploadOBJMesh(gl, parsed)   → mesh { posVBO, normVBO, uvVBO, count }
     bindOBJMesh(gl, loc, mesh)  → vincula pos+norm ao shader atual
     drawOBJMesh(gl, mesh)       → gl.drawArrays(TRIANGLES, 0, count)
   ================================================================ */

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
      /* ── Coleta os vértices da face ─────────────────────────── */
      const fverts = [];
      for (let k = 1; k < parts.length; k++) {
        if (!parts[k]) continue;
        const idx = parts[k].split('/');

        /* OBJ usa índices 1-based; negativos = relativo ao fim */
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

      /* ── Triangulação em leque: (0,1,2), (0,2,3), … ────────── */
      for (let k = 1; k + 1 < fverts.length; k++) {
        const tri = [fverts[0], fverts[k], fverts[k + 1]];

        /* Normal flat como fallback caso o OBJ não tenha vn ────── */
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

        /* Emite 3 vértices por triângulo */
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
    }
    /* Todos os outros tokens (o, g, s, usemtl, mtllib) são ignorados */
  }

  return {
    positions : new Float32Array(outPos),
    normals   : new Float32Array(outNorm),
    uvs       : new Float32Array(outUV),
    count     : outPos.length / 3,
  };
}

/* ── loadOBJ ──────────────────────────────────────────────────────
 * Faz fetch de um arquivo .obj e retorna a Promise do parseOBJ.
 * ─────────────────────────────────────────────────────────────── */
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

/* ── uploadOBJMesh ────────────────────────────────────────────────
 * Envia os arrays parseados para a GPU.
 * Retorna um objeto mesh com { posVBO, normVBO, uvVBO, count }.
 * ─────────────────────────────────────────────────────────────── */
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

  return { posVBO, normVBO, uvVBO, count: parsed.count };
}

/* ── bindOBJMesh ──────────────────────────────────────────────────
 * Vincula pos e norm ao shader. Chame antes de drawOBJMesh().
 * (UV será vinculado quando o suporte a texturas for adicionado.)
 * ─────────────────────────────────────────────────────────────── */
function bindOBJMesh(gl, loc, mesh) {
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posVBO);
  gl.enableVertexAttribArray(loc.aPos);
  gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normVBO);
  gl.enableVertexAttribArray(loc.aNorm);
  gl.vertexAttribPointer(loc.aNorm, 3, gl.FLOAT, false, 0, 0);
}

/* ── drawOBJMesh ──────────────────────────────────────────────────
 * Emite o draw call. Chame bindOBJMesh antes.
 * ─────────────────────────────────────────────────────────────── */
function drawOBJMesh(gl, mesh) {
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}

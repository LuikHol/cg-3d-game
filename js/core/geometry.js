/*
  geometry.js
  Gera as geometrias primitivas usadas na cena: cubo, disco e toro.
  Cada função retorna arrays Float32Array prontos para upload na GPU via gl.bufferData.
*/

function createBoxGeometry() {
  // 6 faces, 4 vértices cada, coordenadas de -0.5 a +0.5
  const positions = new Float32Array([
    /* Front  (+Z) */
    -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
    /* Back   (-Z) */
     0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
    /* Left   (-X) */
    -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
    /* Right  (+X) */
     0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
    /* Top    (+Y) */
    -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
    /* Bottom (-Y) */
    -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
  ]);

  // normais por face
  const normals = new Float32Array([
    /* Front  */ 0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    /* Back   */ 0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1,
    /* Left   */-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    /* Right  */ 1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    /* Top    */ 0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    /* Bottom */ 0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
  ]);

  // índices (36 no total)
  const indices = new Uint16Array([
     0, 1, 2,   0, 2, 3,   /* front  */
     4, 5, 6,   4, 6, 7,   /* back   */
     8, 9,10,   8,10,11,   /* left   */
    12,13,14,  12,14,15,   /* right  */
    16,17,18,  16,18,19,   /* top    */
    20,21,22,  20,22,23,   /* bottom */
  ]);

  // UVs por face (topo com repetição maior para textura de grama)
  const uvs = new Float32Array([
    /* Front  (+Z) */ 0,0, 1,0, 1,1, 0,1,
    /* Back   (-Z) */ 0,0, 1,0, 1,1, 0,1,
    /* Left   (-X) */ 0,0, 1,0, 1,1, 0,1,
    /* Right  (+X) */ 0,0, 1,0, 1,1, 0,1,
    /* Top    (+Y) */ 0,0, 60,0, 60,60, 0,60,
    /* Bottom (-Y) */ 0,0, 1,0, 1,1, 0,1,
  ]);

  return { positions, normals, uvs, indices };
}

// disco unitário no plano XZ, usado para as zonas de coleta/entrega
function createDiscGeometry(segs) {
  const pos = new Float32Array(segs * 9);
  const nor = new Float32Array(segs * 9);
  for (let i = 0; i < segs; i++) {
    const a0 = (i       / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    // triângulo em CCW visto de +Y
    pos[i*9+0] = 0;            pos[i*9+1] = 0; pos[i*9+2] = 0;
    pos[i*9+3] = Math.cos(a1); pos[i*9+4] = 0; pos[i*9+5] = Math.sin(a1);
    pos[i*9+6] = Math.cos(a0); pos[i*9+7] = 0; pos[i*9+8] = Math.sin(a0);
    for (let j = 0; j < 3; j++) {
      nor[i*9+j*3+0] = 0; nor[i*9+j*3+1] = 1; nor[i*9+j*3+2] = 0;
    }
  }
  return { positions: pos, normals: nor, count: segs * 3 };
}

// toro paramétrico no plano XY, usado para os aros das missões
function createTorusGeometry(ringSegs, tubeSegs, tubeRatio) {
  const R = 1.0, r = tubeRatio;
  const pos = [], nor = [], idx = [];
  for (let i = 0; i <= ringSegs; i++) {
    const phi = (i / ringSegs) * Math.PI * 2;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    for (let j = 0; j <= tubeSegs; j++) {
      const theta = (j / tubeSegs) * Math.PI * 2;
      const ct = Math.cos(theta), st = Math.sin(theta);
      pos.push((R + r * ct) * cp, (R + r * ct) * sp, r * st);
      nor.push(ct * cp, ct * sp, st);
    }
  }
  for (let i = 0; i < ringSegs; i++) {
    for (let j = 0; j < tubeSegs; j++) {
      const a = i * (tubeSegs + 1) + j;
      const b = a + tubeSegs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    positions: new Float32Array(pos),
    normals:   new Float32Array(nor),
    indices:   new Uint16Array(idx),
  };
}

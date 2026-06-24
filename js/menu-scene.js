/*
  menu-scene.js
  Renderiza a cidade 3D estática como fundo animado do menu e das subpáginas.
  Usa o mesmo pipeline WebGL do jogo, mas sem drone ou lógica de gameplay.
*/

(function () {
  'use strict';

  const canvas = document.getElementById('menu-canvas');
  if (!canvas) return;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) return;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error('Shader compile: ' + gl.getShaderInfoLog(s));
    }
    return s;
  }

  function createProgram(vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  const prog = createProgram(VERT_SRC, FRAG_SRC);
  gl.useProgram(prog);

  const loc = {
    aPos: gl.getAttribLocation(prog, 'aPosition'),
    aNorm: gl.getAttribLocation(prog, 'aNormal'),
    aUV: gl.getAttribLocation(prog, 'aUV'),
    uModel: gl.getUniformLocation(prog, 'uModel'),
    uView: gl.getUniformLocation(prog, 'uView'),
    uProj: gl.getUniformLocation(prog, 'uProj'),
    uNormalMat: gl.getUniformLocation(prog, 'uNormalMat'),
    uLightPos: gl.getUniformLocation(prog, 'uLightPos'),
    uEyePos: gl.getUniformLocation(prog, 'uEyePos'),
    uColor: gl.getUniformLocation(prog, 'uColor'),
    uAlpha: gl.getUniformLocation(prog, 'uAlpha'),
    uTex: gl.getUniformLocation(prog, 'uTex'),
    uUseTex: gl.getUniformLocation(prog, 'uUseTex'),
    uUnlit: gl.getUniformLocation(prog, 'uUnlit'),
    uAmbient: gl.getUniformLocation(prog, 'uAmbient'),
    uLightIntensity: gl.getUniformLocation(prog, 'uLightIntensity'),
    uEmissive: gl.getUniformLocation(prog, 'uEmissive'),
    uSpecular: gl.getUniformLocation(prog, 'uSpecular'),
    uTreeMode: gl.getUniformLocation(prog, 'uTreeMode'),
    uTreeTrunkTop: gl.getUniformLocation(prog, 'uTreeTrunkTop'),
    uFogColor: gl.getUniformLocation(prog, 'uFogColor'),
    uFogNear: gl.getUniformLocation(prog, 'uFogNear'),
    uFogFar: gl.getUniformLocation(prog, 'uFogFar'),
  };

  gl.uniform1f(loc.uAlpha, 1.0);
  gl.uniform1i(loc.uTex, 0);
  gl.uniform1f(loc.uUseTex, 0.0);
  gl.uniform1f(loc.uUnlit, 0.0);
  gl.uniform1f(loc.uAmbient, 0.25);
  gl.uniform1f(loc.uLightIntensity, 1.0);
  gl.uniform1f(loc.uTreeMode, 0.0);
  gl.uniform1f(loc.uTreeTrunkTop, 0.0);

  const geo = createBoxGeometry();
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
  const IDX_COUNT = geo.indices.length;

  const discGeo = createDiscGeometry(40);
  const discPosVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, discPosVBO);
  gl.bufferData(gl.ARRAY_BUFFER, discGeo.positions, gl.STATIC_DRAW);

  const discNormVBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, discNormVBO);
  gl.bufferData(gl.ARRAY_BUFFER, discGeo.normals, gl.STATIC_DRAW);
  const DISC_COUNT = discGeo.count;

  const torusGeo = createTorusGeometry(56, 14, 0.08);
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

  let treeMesh = null;
  let carMesh = null;
  let benchMesh = null;
  let trashMesh = null;

  loadOBJ('js/objects/arvore.obj').then(parsed => { treeMesh = uploadOBJMesh(gl, parsed); }).catch(() => {});
  loadOBJ('js/objects/Car.obj').then(parsed => { carMesh = uploadOBJMesh(gl, parsed); }).catch(() => {});
  loadOBJ('js/objects/Bench_LowRes.obj').then(parsed => { benchMesh = uploadOBJMesh(gl, parsed); }).catch(() => {});
  loadOBJ('js/objects/caixa%20de%20lixo.obj').then(parsed => { trashMesh = uploadOBJMesh(gl, parsed); }).catch(() => {});

  // Menu usa camera fixa, sem gameplay, apenas para exibir a cidade real em 3D.
  City.buildTrees([]);

  const modelMat = mat4.create();
  const viewMat = mat4.create();
  const projMat = mat4.create();
  const normMat3 = mat3.create();
  const camPos = vec3.fromValues(36, 28, 36);
  const lookAt = vec3.fromValues(0, 6, 0);
  const lightPos = vec3.create();

  const timeOfDay = 0.38;
  let frameTime = 0;

  function frame(now) {
    frameTime = now * 0.001;

    const sunAngle = (timeOfDay - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle) * Renderer.LIGHT_R;
    const sunY = sunHeight * Renderer.LIGHT_R;
    const sunZ = Math.sin(sunAngle * 0.4 + 1.0) * 35;

    const moonAngle = sunAngle + Math.PI * 1.04;
    const moonX = Math.cos(moonAngle) * Renderer.LIGHT_R * 0.92;
    const moonY = Math.sin(moonAngle) * Renderer.LIGHT_R * 0.82;
    const moonZ = Math.sin(moonAngle * 0.35 + 0.8) * 40;

    const nightBlend = Math.max(0, Math.min(1, -sunHeight * 3.0 + 0.25));

    lightPos[0] = sunX * (1 - nightBlend) + moonX * nightBlend;
    lightPos[1] = sunY * (1 - nightBlend) + moonY * nightBlend;
    lightPos[2] = sunZ * (1 - nightBlend) + moonZ * nightBlend;

    const ambientVal = 0.12 + Math.max(0, sunHeight) * 0.22 + nightBlend * 0.06;
    const sky = Renderer.skyColor(timeOfDay);
    const fogNear = 50.0;
    const fogFar = 170.0;

    mat4.lookAt(viewMat, camPos, lookAt, [0, 1, 0]);
    mat4.perspective(projMat, Math.PI / 3, canvas.width / canvas.height, 0.1, 600);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(sky[0], sky[1], sky[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.uniformMatrix4fv(loc.uView, false, viewMat);
    gl.uniformMatrix4fv(loc.uProj, false, projMat);
    gl.uniform3fv(loc.uLightPos, lightPos);
    gl.uniform3fv(loc.uEyePos, camPos);
    gl.uniform1f(loc.uAmbient, ambientVal);
    gl.uniform1f(loc.uLightIntensity, 1.0 - nightBlend * 0.85);
    gl.uniform3f(loc.uFogColor, sky[0] * 0.82 + 0.06, sky[1] * 0.82 + 0.06, sky[2] * 0.84 + 0.06);
    gl.uniform1f(loc.uFogNear, fogNear);
    gl.uniform1f(loc.uFogFar, fogFar);
    gl.uniform3f(loc.uEmissive, 0.0, 0.0, 0.0);
    gl.uniform1f(loc.uAlpha, 1.0);
    gl.uniform1f(loc.uSpecular, 1.0);

    const rc = {
      gl,
      loc,
      modelMat,
      viewMat,
      normMat3,
      camPos,
      IDX_COUNT,
      DISC_COUNT,
      TOR_IDX_COUNT,
      bindMesh,
      bindDisc,
      bindTorus,
      frameTime,
      get treeMesh() { return treeMesh; },
      get carMesh() { return carMesh; },
      get benchMesh() { return benchMesh; },
      get trashMesh() { return trashMesh; },
      get timeOfDay() { return timeOfDay; },
    };

    bindMesh();
    Renderer.drawSkyObjects(rc, sunHeight, nightBlend, sunX, sunY, sunZ);
    bindMesh();

    Renderer.drawGroundAndRoads(rc, nightBlend);
    Renderer.drawCrosswalks(rc, nightBlend);
    City.drawPark(rc, frameTime, nightBlend);
    City.drawCityProps(rc, nightBlend);
    City.drawCars(rc);

    gl.uniform1f(loc.uSpecular, 0.06);
    City.drawBuildings(rc, nightBlend);
    City.drawBuildingLights(rc, frameTime, nightBlend);
    City.drawTrees(rc, frameTime, nightBlend);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

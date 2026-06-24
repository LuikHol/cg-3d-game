# Documentação Técnica — Delivered by Drones

Este documento detalha o funcionamento interno do projeto, a integração entre os módulos e como cada requisito técnico da disciplina de Computação Gráfica foi implementado.

---

## Sumário

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Pipeline de inicialização WebGL](#2-pipeline-de-inicialização-webgl)
3. [Shaders e modelo de iluminação](#3-shaders-e-modelo-de-iluminação)
4. [Projeção perspectiva e câmera](#4-projeção-perspectiva-e-câmera)
5. [Ciclo dia/noite — fonte de luz móvel](#5-ciclo-dianoite--fonte-de-luz-móvel)
6. [Objetos animados por transformações geométricas](#6-objetos-animados-por-transformações-geométricas)
7. [Objetos com textura](#7-objetos-com-textura)
8. [Objetos com cor sólida](#8-objetos-com-cor-sólida)
9. [Carregamento de arquivos OBJ](#9-carregamento-de-arquivos-obj)
10. [Geometrias primitivas (cubo, disco, toro)](#10-geometrias-primitivas-cubo-disco-toro)
11. [Física do drone](#11-física-do-drone)
12. [Colisão com a cidade](#12-colisão-com-a-cidade)
13. [Sistema de missões](#13-sistema-de-missões)
14. [Névoa atmosférica](#14-névoa-atmosférica)
15. [Minimapa 2D](#15-minimapa-2d)
16. [Integração entre módulos](#16-integração-entre-módulos)
17. [Requisitos da disciplina — checklist](#17-requisitos-da-disciplina--checklist)

---

## 1. Visão geral da arquitetura

O projeto é uma aplicação WebGL pura, sem engines ou frameworks de renderização. A única biblioteca externa é a **gl-matrix**, usada exclusivamente para álgebra linear (multiplicação de matrizes `mat4`, `mat3`, operações com `vec3`).

O código é dividido em módulos JavaScript com o padrão IIFE (Immediately Invoked Function Expression), expondo namespaces globais:

```
window
├── Renderer   — renderização de toda a cena 3D
├── City        — dados e draw da cidade procedural
├── Mission     — lógica e draw das missões
├── Input       — estado do teclado
├── MiniMap     — minimapa 2D em canvas separado
└── game.js     — loop principal (IIFE anônima)
```

O fluxo de execução é:

```
jogo.html carrega os scripts na ordem correta
  → shaders.js, geometry.js, obj-loader.js (sem dependências)
  → city.js, renderer.js, mission.js (dependem dos anteriores)
  → minimap.js
  → game.js (inicializa tudo e inicia o loop)
```

---

## 2. Pipeline de inicialização WebGL

Todo o setup ocorre em `game.js` antes do loop principal:

### 2.1 Contexto

```js
const gl = canvas.getContext('webgl');
```

O canvas é redimensionado para `window.innerWidth × window.innerHeight` a cada resize.

### 2.2 Compilação dos shaders

```js
function compileShader(type, src) { ... }   // gl.createShader → shaderSource → compileShader
function createProgram(vsSrc, fsSrc) { ... } // createProgram → attachShader × 2 → linkProgram
const prog = createProgram(VERT_SRC, FRAG_SRC);
```

Os fontes GLSL vivem como strings em `shaders.js` (`VERT_SRC` e `FRAG_SRC`). Essa separação permite que o mesmo par de shaders seja reusado tanto em `game.js` quanto em `menu-scene.js`.

### 2.3 Localização de atributos e uniforms

Após o link, todos os handles são coletados de uma vez em um objeto `loc`:

```js
const loc = {
  aPos, aNorm, aUV,               // atributos de vértice
  uModel, uView, uProj,           // matrizes de transformação
  uNormalMat,                     // matriz normal (transposta da inversa do model)
  uLightPos, uEyePos,             // iluminação
  uColor, uAlpha, uTex, uUseTex,  // material
  uAmbient, uLightIntensity,      // nível de luz
  uEmissive, uSpecular,           // emissivo e brilho
  uTreeMode, uTreeTrunkTop,       // modo árvore
  uFogColor, uFogNear, uFogFar,   // névoa
};
```

### 2.4 Upload de geometrias para a GPU

Cada tipo de primitiva (cubo, disco, toro) tem seus próprios VBOs criados uma vez e reutilizados em todos os frames:

```
posVBO   → posições XYZ do cubo
normVBO  → normais por face do cubo
uvVBO    → coordenadas UV do cubo
idxBuf   → índices do cubo (36 para 12 triângulos)

discPosVBO / discNormVBO → disco (40 triângulos, gl.drawArrays)
torPosVBO / torNormVBO + torIdxBuf → toro paramétrico
```

Modelos `.obj` são carregados assincronamente via `loadOBJ()` e seus VBOs são criados ao chegarem, sem bloquear o loop.

---

## 3. Shaders e modelo de iluminação

**Arquivo:** `js/core/shaders.js`

O projeto usa **um único par de shaders** para renderizar todos os objetos da cena.

### 3.1 Vertex Shader

```glsl
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat3 uNormalMat;

void main() {
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vFragPos      = worldPos.xyz;         // posição no espaço do mundo
  vNormal       = uNormalMat * aNormal; // normal transformada
  vUV           = aUV;
  gl_Position   = uProj * uView * worldPos;
}
```

- `uModel` posiciona/escala/rotaciona cada objeto individualmente
- `uView` é a matriz da câmera (via `mat4.lookAt`)
- `uProj` é a projeção perspectiva (via `mat4.perspective`, FOV 60°)
- `uNormalMat` é a transposta da inversa de `uModel`, necessária para transformar normais corretamente quando há escala não-uniforme

### 3.2 Fragment Shader — Blinn-Phong

O modelo de iluminação implementado é **Blinn-Phong**:

```glsl
// componente difusa (Lambert)
float diff = max(dot(norm, lightDir), 0.0);

// componente especular (Blinn-Phong — usa o vetor half-way)
vec3  halfVec = normalize(lightDir + viewDir);
float spec    = pow(max(dot(norm, halfVec), 0.0), 64.0) * 0.45 * uSpecular;

// composição final
vec3 color = (uAmbient + d) * baseColor + s;
```

O resultado final é:

$$\text{color} = (k_a + k_d \cdot \max(\hat{n} \cdot \hat{l}, 0)) \cdot C_{base} + k_s \cdot (\hat{n} \cdot \hat{h})^{64}$$

Onde:
- $k_a$ = `uAmbient` (varia entre 0.08 à noite e 0.60 ao meio-dia)
- $k_d$ = componente difusa de Lambert
- $k_s$ = `uSpecular` (configurado por objeto: 0 para matte, 1 para brilhoso)
- $\hat{h}$ = vetor half-way = `normalize(lightDir + viewDir)`

### 3.3 Modo árvore

Uma feature especial do shader permite colorir árvores automaticamente sem múltiplos draw calls:

```glsl
if (uTreeMode > 0.5) {
  float isLeaf = step(uTreeTrunkTop + 1.20, vFragPos.y);
  baseColor = mix(trunkColor, uColor, isLeaf); // tronco marrom / copa verde
}
```

A altura de transição `uTreeTrunkTop` é passada por uniform, calculada na CPU com base na posição mundial da árvore.

### 3.4 Controle de iluminação por uniform

Objetos que não devem ser afetados pela iluminação (como o sprite do sol e da lua) usam `uUnlit = 1.0`, que força a cor final a ser apenas `baseColor` sem nenhum cálculo de luz.

---

## 4. Projeção perspectiva e câmera

**Arquivo:** `js/game.js`

### 4.1 Projeção perspectiva

```js
mat4.perspective(projMat,
  Math.PI / 3,                      // FOV vertical: 60°
  canvas.width / canvas.height,     // aspect ratio dinâmico
  0.1,                              // near plane
  600                               // far plane
);
gl.uniformMatrix4fv(loc.uProj, false, projMat);
```

A matriz é recalculada a cada frame para acomodar redimensionamento da janela.

### 4.2 Câmera orbital em terceira pessoa

A câmera orbita o drone em torno de seu pivô (`drone.pos`). A posição da câmera é calculada em coordenadas esféricas:

```js
const hDist = Math.cos(drone.camPitch) * drone.CAM_DIST; // 9 unidades
camPos[0] = drone.pos[0] + Math.sin(drone.yaw)  * hDist;
camPos[1] = drone.pos[1] + Math.sin(camPitch)   * drone.CAM_DIST;
camPos[2] = drone.pos[2] + Math.cos(drone.yaw)  * hDist;

mat4.lookAt(viewMat, camPos, drone.pos, [0, 1, 0]);
```

- **Yaw** (rotação horizontal) é controlado pelo movimento do mouse no eixo X (via Pointer Lock API)
- **Pitch** (inclinação vertical) é controlado pelo mouse no eixo Y, limitado a [-0.08, 1.45] rad
- Um `camPitchNudge` suaviza a câmera verticalmente conforme o drone sobe/desce

### 4.3 Pointer Lock

O mouse é capturado via `canvas.requestPointerLock()`, lendo `e.movementX` e `e.movementY` do evento `mousemove`. Ao perder o lock (janela minimizada, diálogo aberto), o jogo pausa automaticamente.

---

## 5. Ciclo dia/noite — fonte de luz móvel

**Arquivo:** `js/game.js` e `js/renderer.js`

O sol e a lua orbitam a cena em um ciclo contínuo. Isso constitui a **fonte de luz com movimentação** exigida nos requisitos.

### 5.1 Progressão do tempo

```js
let timeOfDay = 0.38; // começa por volta das 9h
const DAY_SPEED = 1 / 480; // ciclo de 8 minutos reais

timeOfDay = (timeOfDay + DAY_SPEED * dt) % 1.0;
```

### 5.2 Cálculo da posição da luz

```js
const sunAngle = (timeOfDay - 0.25) * Math.PI * 2; // 0.25 = nascer do sol
const LIGHT_R  = 120; // raio da órbita

lightPos[0] = Math.cos(sunAngle) * LIGHT_R;
lightPos[1] = Math.sin(sunAngle) * LIGHT_R;
lightPos[2] = 0;

gl.uniform3fv(loc.uLightPos, lightPos);
```

O vetor `lightPos` é enviado ao shader a cada frame via `uLightPos`. O Fragment Shader calcula `lightDir = normalize(uLightPos - vFragPos)` para cada fragmento.

### 5.3 Variação da intensidade e da cor ambiente

À medida que o sol desce abaixo do horizonte (`sunHeight < 0`):

```js
const ambientDay   = 0.60;
const ambientNight = 0.08;
// interpolação suave conforme sunHeight
gl.uniform1f(loc.uAmbient, lerp(ambientNight, ambientDay, t));
gl.uniform1f(loc.uLightIntensity, t > 0 ? 1.0 : 0.15); // lua = 15% do sol
```

### 5.4 Cor do céu

O céu é um gradiente interpolado entre 5 paletas (amanhecer, manhã, tarde, entardecer, noite) em `renderer.js`:

```js
const SKY_COLORS = [
  { tod: 0.0,  top: [0.02,0.02,0.10], bot: [0.08,0.06,0.20] }, // noite
  { tod: 0.22, top: [0.60,0.30,0.10], bot: [0.90,0.50,0.30] }, // amanhecer
  { tod: 0.30, top: [0.40,0.65,0.90], bot: [0.70,0.85,0.95] }, // manhã
  // ...
];
```

O quad do céu é desenhado sem profundidade (`gl.depthMask(false)`) para sempre ficar atrás de tudo.

---

## 6. Objetos animados por transformações geométricas

**Arquivo:** `js/renderer.js`

Vários objetos da cena são animados via transformações geométricas aplicadas à matriz `uModel` a cada frame.

### 6.1 Hélices do drone — rotação contínua

```js
const helixAngle = frameTime * helixSpeed; // aumenta a cada frame

mat4.identity(modelMat);
mat4.multiply(modelMat, droneBase, modelMat); // posiciona sobre o drone
mat4.translate(modelMat, modelMat, PROP_LOCAL[i]); // offset da hélice
mat4.rotateY(modelMat, modelMat, helixAngle);      // rotação no eixo Y
mat4.scale(modelMat, modelMat, [0.7, 0.7, 0.7]);
```

As 4 hélices (helix1–4.obj) giram independentemente no plano XZ.

### 6.2 Sol e Lua — translação orbital

O sprite do sol/lua é um quad plano que orbita a cena:

```js
mat4.identity(modelMat);
mat4.translate(modelMat, modelMat, [lightPos[0], lightPos[1], lightPos[2]]);
mat4.scale(modelMat, modelMat, [sunRadius, sunRadius, 1]);
// billboard: o quad é sempre virado para a câmera
mat4.rotateY(modelMat, modelMat, -Math.atan2(lightPos[0], lightPos[2]));
```

### 6.3 Carros — translação periódica

```js
const t = (frameTime * carSpeed + car.offset) % 1.0;
const pos = lerpAlongPath(car.path, t); // interpola ao longo de segmentos
mat4.translate(modelMat, modelMat, pos);
mat4.rotateY(modelMat, modelMat, car.heading);
```

### 6.4 Itens flutuantes das missões

O presente (Gift Box) e o coração flutuam sobre o ponto de coleta com animação de `bob` (seno) e `spin` (rotação contínua):

```js
const bob  = Math.sin(frameTime * 2.6) * 0.20;
const spin = frameTime * 0.9;
mat4.translate(modelMat, modelMat, [x, 1.5 + bob, z]);
mat4.rotateY(modelMat, modelMat, spin);
```

### 6.5 Tilt visual do drone

O corpo do drone inclina-se proporcionalmente à velocidade, dando feedback visual ao jogador:

```js
const tpTarget = (vFwd   / drone.SPEED) *  drone.MAX_TILT;
const trTarget = (vRight / drone.SPEED) * -drone.MAX_TILT;
// suavização por interpolação exponencial
drone.tiltPitch += (tpTarget - drone.tiltPitch) * drone.TILT_SPEED * dt;
drone.tiltRoll  += (trTarget - drone.tiltRoll)  * drone.TILT_SPEED * dt;
```

---

## 7. Objetos com textura

**Arquivo:** `js/renderer.js`

O uso de textura é controlado pelo uniform `uUseTex`:

- **`uUseTex = 1.0`** → o Fragment Shader multiplica `uColor` pela amostra da textura: `baseColor = uColor * texel.rgb`
- **`uUseTex = 0.0`** → usa apenas `uColor` (cor sólida)

### 7.1 Textura do drone (body.png)

```js
// placeholder imediato de 1×1 pixel azul
gl.texImage2D(..., new Uint8Array([50, 50, 230, 255]));

// substitui pela textura real ao carregar
img.onload = () => {
  gl.texImage2D(..., img);
};
img.src = 'js/textures/body.png';
```

O drone recebe `uUseTex = 1.0` no draw call.

### 7.2 Textura do sol (sol.png) e da lua (lua.png)

Ambos começam com um gradiente radial procedural como fallback e substituem a textura quando a imagem carrega.

### 7.3 Textura de grama procedural

O chão usa uma textura gerada no canvas 2D:

```js
const c = document.createElement('canvas'); // 128×128
ctx.fillStyle = 'rgba(70,120,56,1.0)';
ctx.fillRect(0, 0, size, size);
// ruído: ~900 quadrados com cores de grama variadas
for (let i = 0; i < 900; i++) { ... ctx.fillRect(x, y, w, h); }
// enviada para a GPU como textura com REPEAT
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
```

---

## 8. Objetos com cor sólida

Todos os prédios, ruas, calçadas, parque, crosswalks, postes, hidrantes e aros das missões são desenhados com `uUseTex = 0.0` e uma cor RGB definida diretamente via `gl.uniform3f(loc.uColor, r, g, b)`.

Exemplo (prédios em `city.js`):

```js
const [cx, cz, hw, hd, ht, r, g, b] = buildings[i];
// ...
gl.uniform3f(loc.uColor, r, g, b);
gl.drawElements(gl.TRIANGLES, IDX_COUNT, gl.UNSIGNED_SHORT, 0);
```

As cores dos prédios são definidas no array `buildings[]` com valores RGB normalizados.

---

## 9. Carregamento de arquivos OBJ

**Arquivo:** `js/core/obj-loader.js`

O parser OBJ é completamente autoral, sem uso de bibliotecas.

### 9.1 Tokens suportados

| Token | Significado |
|---|---|
| `v x y z` | posição de vértice |
| `vn x y z` | normal de vértice |
| `vt u v` | coordenada de textura |
| `f v/vt/vn ...` | face (triangulação em leque) |
| `usemtl nome` | início de segmento de material |
| `o`, `g`, `s`, `#`, `mtllib` | ignorados |

### 9.2 Variações do índice de face aceitas

```
f v
f v/vt
f v//vn
f v/vt/vn
```

Índices negativos (relativos ao fim do array) também são tratados.

### 9.3 Algoritmo de parsing

```js
function parseOBJ(text) {
  // acumula v/vn/vt em arrays raw
  for (linha de texto) {
    if (tok === 'v')  vPos.push([x, y, z]);
    if (tok === 'vn') vNorm.push([x, y, z]);
    if (tok === 'vt') vTex.push([u, v]);
    if (tok === 'f') {
      // coleta vértices da face
      // triangulação em leque: (0,1,2), (0,2,3), ...
      for (k = 1; k+1 < fverts.length; k++) {
        // 3 vértices por triângulo
        // se não houver normal: gera normal flat pelo produto vetorial
        outPos.push(...); outNorm.push(...); outUV.push(...);
      }
    }
  }
  return { positions: Float32Array, normals: Float32Array, uvs: Float32Array, count };
}
```

### 9.4 Normal flat como fallback

Se o arquivo `.obj` não contém tokens `vn`, uma normal plana é calculada por triângulo via produto vetorial:

```js
const e1 = b - a, e2 = c - a;
const n = cross(e1, e2);
normalize(n); // usada nos 3 vértices do triângulo
```

### 9.5 Upload para a GPU

```js
function uploadOBJMesh(gl, parsed) {
  posVBO  = createAndFill(gl, parsed.positions);
  normVBO = createAndFill(gl, parsed.normals);
  uvVBO   = createAndFill(gl, parsed.uvs);
  return { posVBO, normVBO, uvVBO, count, segments };
}
```

Os dados são `Float32Array` não-indexados, desenhados com `gl.drawArrays(gl.TRIANGLES, 0, count)`.

### 9.6 Segmentos por material

A diretiva `usemtl` divide o mesh em segmentos:

```js
mesh.segments = [
  { material: 'Box', start: 0, count: 120 },
  { material: 'Yellow_Ribbon', start: 120, count: 36 },
];
```

Isso permite colorir diferentes partes do presente (caixa e laço) sem múltiplos arquivos.

### 9.7 Modelos carregados

| Arquivo | Uso |
|---|---|
| `drone.obj` | corpo principal do drone |
| `helix1–4.obj` | hélices animadas (uma por braço) |
| `Arrow.obj` | seta de waypoint sobre o drone |
| `GiftBox_blend.obj` | presente flutuante na coleta |
| `arvore.obj` | árvores da cidade |
| `Car.obj` | carros em movimento |
| `Bench_LowRes.obj` | bancos do parque |
| `caixa de lixo.obj` | lixeiras nas calçadas |

---

## 10. Geometrias primitivas (cubo, disco, toro)

**Arquivo:** `js/core/geometry.js`

Três geometrias são geradas na CPU e enviadas uma vez para a GPU.

### 10.1 Cubo

- 6 faces × 4 vértices = 24 vértices (não compartilhados, para flat shading correto)
- Coordenadas de -0.5 a +0.5 em cada eixo
- 36 índices (`gl.drawElements`)
- UVs por face, com escala maior no topo (para textura de grama não esticar)

Usado em: prédios, ruas, calçadas, corpo fallback do drone, cargo box, faróis.

### 10.2 Disco

- Triângulos em leque a partir do centro, no plano XZ
- 40 segmentos = 40 triângulos
- `gl.drawArrays(gl.TRIANGLES, 0, DISC_COUNT)`

Usado em: zonas de coleta (verde) e entrega (laranja), aura vertical pulsante.

### 10.3 Toro paramétrico

- `ringSegs = 56`, `tubeSegs = 14`, `tubeRatio = 0.08` (tubo fino = 8% do raio)
- Gerado pelas equações paramétricas:

$$P(\theta, \phi) = \Big((R + r\cos\phi)\cos\theta,\ r\sin\phi,\ (R + r\cos\phi)\sin\theta\Big)$$

- `gl.drawElements` com índices de 16 bits

Usado em: aros das missões (escalados via `mat4.scale`).

---

## 11. Física do drone

**Arquivo:** `js/game.js`

O drone usa um modelo de física com aceleração, atrito (drag) e velocidade terminal.

### 11.1 Equações de movimento

```
vel += (aceleração - drag × vel) × dt
pos += vel × dt
```

No código:

```js
drone.vel[0] += (ax - drone.DRAG  * drone.vel[0]) * dt; // horizontal X
drone.vel[2] += (az - drone.DRAG  * drone.vel[2]) * dt; // horizontal Z
drone.vel[1] += (ay - drone.VDRAG * drone.vel[1]) * dt; // vertical Y
```

### 11.2 Parâmetros

| Parâmetro | Valor | Descrição |
|---|---|---|
| `ACCEL` | 28 | aceleração aplicada pelo input |
| `DRAG` | 2.2 | atrito horizontal |
| `VDRAG` | 1.8 | atrito vertical |
| `SPEED` | 10 | velocidade horizontal máxima (m/s) |
| `VSPEED` | 22 | velocidade vertical máxima (m/s) |
| `GRAVITY` | 2.0 | gravidade (reduzida a ~25% em alta velocidade horizontal) |

### 11.3 Boost ao passar pelos aros

Ao cruzar um aro, o drone recebe um impulso na direção que estava voando:

```js
_drone.boostVel[0] = -Math.sin(yaw) * BOOST_SPEED;
_drone.boostVel[2] = -Math.cos(yaw) * BOOST_SPEED;
// o boostVel decai exponencialmente:
drone.boostVel[i] -= drone.boostVel[i] * drone.BOOST_DRAG * dt;
```

---

## 12. Colisão com a cidade

**Arquivo:** `js/city.js`

A detecção de colisão é feita por AABB (Axis-Aligned Bounding Box):

```js
function resolveCollision(pos, oldPos, halfSize, halfHeight) {
  for (const [cx, cz, hw, hd, ht, ...] of buildings) {
    // testa sobreposição em X, Y e Z separadamente
    const overlapX = (pos[0] + halfSize > cx - hw) && (pos[0] - halfSize < cx + hw);
    const overlapZ = (pos[2] + halfSize > cz - hd) && (pos[2] - halfSize < cz + hd);
    const overlapY = pos[1] < ht && pos[1] + halfHeight > 0;

    if (overlapX && overlapZ && overlapY) {
      // restaura posição no eixo que colidiu
      if (!overlapXOld) { pos[0] = oldPos[0]; hitX = true; }
      if (!overlapZOld) { pos[2] = oldPos[2]; hitZ = true; }
    }
  }
  return { hitX, hitZ };
}
```

O drone usa `halfSize = 1.3` e `halfHeight = 1.7`.

---

## 13. Sistema de missões

**Arquivo:** `js/mission.js`

### 13.1 Fases de uma missão

```
pickup → [diálogo] → flying → delivery → done
```

- **pickup**: o drone deve pousar na zona verde por 0.5s
- **flying**: passa pelos N aros em ordem, pontuando por velocidade
- **delivery**: pousa na zona laranja por 0.5s
- **done**: resultado exibido, próxima missão inicia em 2s

### 13.2 Detecção de cruzamento dos aros

Cada aro tem um plano definido por uma normal `h.normal` (calculada a partir de `angle` e `tilt`). O cruzamento é detectado pela mudança de sinal da distância assinada:

```js
function signedDist(pos, h) {
  return dot(pos - h.pos, h.normal);
}

// cruzamento ocorre quando o sinal muda de um frame para o outro
if (Math.sign(currDist) !== Math.sign(prevDist)) {
  // verifica se está dentro do raio do aro
  if (radialDist(pos, h) < h.radius - hitPad) {
    // ponto marcado
  }
}
```

### 13.3 Pontuação

```
score_do_aro = max(100, 1000 - floor(hoopTimer × decay))
```

- `hoopTimer` acumula segundos desde o último aro
- `decay` aumenta a cada missão (40, 60, 85, 115, 160)
- Bônus de entrega: +500 pontos
- Ranking: S(≥75%), A(≥58%), B(≥42%), C(abaixo)

---

## 14. Névoa atmosférica

**Arquivo:** `js/core/shaders.js`

A névoa é calculada no Fragment Shader com base na distância ao fragmento:

```glsl
float fogDist = length(vFragPos - uEyePos);
float fogFactor = clamp((fogDist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
gl_FragColor = vec4(mix(litColor, uFogColor, fogFactor), alpha);
```

- `uFogNear = 55.0` — névoa começa a 55 unidades da câmera
- `uFogFar  = 180.0` — total a 180 unidades
- A cor da névoa (`uFogColor`) muda com o horário do dia (azul claro de dia, azul escuro à noite)

---

## 15. Minimapa 2D

**Arquivo:** `js/minimap.js`

O minimapa é um canvas HTML2D separado, sobreposto ao canvas WebGL via CSS (`position: fixed`). Não usa WebGL — apenas a API Canvas 2D.

- **Escala**: pixels por unidade de mundo, calculada a partir do tamanho do mapa e da extensão do mundo
- **Camada de cidade**: pré-renderizada uma vez em `initCityLayer()` usando os mesmos dados de `buildings` do `City`
- **Elementos dinâmicos**: drone (vermelho), coleta (verde), entrega (laranja), aros (branco) — redesenhados a cada frame
- Conversão de coordenadas: `screenX = centerX + worldX × scale`

---

## 16. Integração entre módulos

O diagrama abaixo mostra como os módulos se comunicam:

```
game.js
  │
  ├── Input.isDown()          → verifica teclas por frame
  │
  ├── Mission.init(drone)     → passa referência do drone para a missão
  ├── Mission.update(dt)      → avança lógica, atualiza HUD
  ├── Mission.draw(rc)        → desenha aros, zonas, seta, presente
  │
  ├── Renderer.init(drone, gl)
  ├── Renderer.drawSkyObjects(rc)   → céu, sol, lua
  ├── Renderer.drawGroundAndRoads(rc)
  ├── Renderer.drawCrosswalks(rc)
  ├── Renderer.drawDrone(rc)        → drone OBJ + hélices + luzes + carga
  │
  ├── City.buildTrees(MISSION_DEFS) → popula instâncias de árvores
  ├── City.drawBuildings(rc)
  ├── City.drawTrees(rc, treeMesh)
  ├── City.drawCars(rc, carMesh)
  ├── City.drawCityProps(rc, ...)
  ├── City.resolveCollision(pos, oldPos, halfSize, halfHeight)
  │
  └── minimap.draw(drone.pos, mission)
```

O objeto `rc` (render context) passado entre módulos contém:

```js
rc = {
  gl, loc,         // contexto WebGL e localização de uniforms
  modelMat,        // mat4 reutilizável para cada objeto
  normMat3,        // mat3 da normal (calculada de modelMat)
  IDX_COUNT,       // contagem de índices do cubo
  DISC_COUNT,      // contagem de vértices do disco
  TOR_IDX_COUNT,   // contagem de índices do toro
  bindMesh,        // função que ativa os VBOs do cubo
  bindDisc,        // função que ativa os VBOs do disco
  bindTorus,       // função que ativa os VBOs do toro
  frameTime,       // tempo acumulado (para animações)
  timeOfDay,       // 0–1 (para névoa, emissivos noturnos)
}
```

---

## 17. Requisitos da disciplina — checklist

### Requisitos gerais

| Requisito | Implementação |
|---|---|
| **I. Câmera com projeção perspectiva** | `mat4.perspective` (FOV 60°) em `game.js`; câmera orbital 3ª pessoa controlada por mouse via Pointer Lock |
| **II. Iluminação Phong com fonte de luz móvel** | Fragment Shader Blinn-Phong em `shaders.js`; sol e lua orbitam a cena em tempo real em `renderer.js` |
| **III. Objeto animado por transformações geométricas** | Hélices (rotação), sol/lua (translação orbital), carros (translação periódica), presente/coração (bob + spin), tilt do drone (rotação proporcional à velocidade) |
| **IV. Objeto com textura** | Drone (`body.png`), sol (`sol.png`), lua (`lua.png`), chão (textura de grama procedural) |
| **V. Objeto com cor sólida** | Prédios, ruas, aros, zonas de missão — todos via `uColor` sem textura |
| **VI. WebGL puro** | `canvas.getContext('webgl')` em `game.js`; nenhuma biblioteca de renderização |
| **VI. Apenas biblioteca de álgebra linear** | Apenas `gl-matrix` (mat4, mat3, vec3) em `js/lib/gl-matrix-min.js` |
| **VII. Canvas HTML5 para contexto gráfico** | `<canvas id="canvas">` em `jogo.html`; nenhuma função gráfica de biblioteca além da inicialização |
| **VIII. Biblioteca para eventos de teclado** | `input.js` usa apenas `addEventListener('keydown'/'keyup')` nativos do DOM |

### Requisitos de jogo

| Requisito | Implementação |
|---|---|
| **I. Câmera livre com movimentação** | Câmera em terceira pessoa com yaw+pitch livres controlados pelo mouse; drone se move pelo ambiente aberto |
| **II. Objetos 3D carregados de arquivos OBJ** | Drone, hélices, seta, presente, árvores, carros, banco, lixeira — todos carregados via `loadOBJ()` |
| **III. Leitor de OBJ próprio** | `parseOBJ()` em `obj-loader.js` — completamente autoral, suporta v/vn/vt/f, triangulação, normais flat e segmentos por material |
| **IV. Modelos gratuitos da internet** | Carro, banco, lixeira, presente, árvores — atribuídos nos créditos |
| **V. Modelos autorais não obrigatórios** | Drone, hélices e seta foram modelados pela equipe |

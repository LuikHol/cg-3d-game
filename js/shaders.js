/* ================================================================
   shaders.js – código-fonte GLSL dos shaders (Vertex + Fragment)
   ================================================================ */

/* ── Vertex Shader ─────────────────────────────────────────────── */
const VERT_SRC = /* glsl */`
attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat3 uNormalMat;   /* transposta da inversa de uModel (3x3) */

varying vec3 vNormal;
varying vec3 vFragPos;

void main() {
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vFragPos      = worldPos.xyz;
  vNormal       = uNormalMat * aNormal;
  gl_Position   = uProj * uView * worldPos;
}
`;

/* ── Fragment Shader (Blinn-Phong) ─────────────────────────────── */
const FRAG_SRC = /* glsl */`
precision mediump float;

uniform vec3  uLightPos;   /* posição da fonte de luz (sol) no mundo */
uniform vec3  uEyePos;     /* posição da câmera no mundo             */
uniform vec3  uColor;      /* cor RGB do objeto                      */
uniform float uAlpha;      /* opacidade (1.0 = totalmente opaco)     */

varying vec3 vNormal;
varying vec3 vFragPos;

void main() {
  vec3 norm     = normalize(vNormal);
  vec3 lightDir = normalize(uLightPos - vFragPos);
  vec3 viewDir  = normalize(uEyePos   - vFragPos);

  /* Componente ambiente */
  float ambient = 0.25;

  /* Componente difusa (Lambert) */
  float diff = max(dot(norm, lightDir), 0.0);

  /* Componente especular (Blinn-Phong) */
  vec3  halfVec = normalize(lightDir + viewDir);
  float spec    = pow(max(dot(norm, halfVec), 0.0), 64.0) * 0.45;

  vec3 color = (ambient + diff) * uColor + spec * vec3(1.0);
  gl_FragColor  = vec4(color, uAlpha);
}
`;

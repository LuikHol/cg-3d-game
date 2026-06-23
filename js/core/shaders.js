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

uniform vec3  uLightPos;    /* posição da fonte de luz (sol) no mundo */
uniform vec3  uEyePos;      /* posição da câmera no mundo             */
uniform vec3  uColor;       /* cor RGB do objeto                      */
uniform float uAlpha;       /* opacidade (1.0 = totalmente opaco)     */
uniform float uAmbient;        /* nível de luz ambiente (varia dia/noite)*/
uniform float uLightIntensity; /* intensidade da fonte (1=sol, ~0.15=lua) */
uniform vec3  uEmissive;       /* cor emissiva – ignora iluminação       */
uniform float uSpecular;       /* escala do especular (0=matte, 1=full)  */
uniform float uTreeMode;       /* 1=ativa cor tronco/copa para árvores    */
uniform float uTreeTrunkTop;   /* altura Y do fim do tronco no mundo      */
uniform vec3  uFogColor;       /* cor da névoa atmosférica                */
uniform float uFogNear;        /* início da névoa (distância da câmera)   */
uniform float uFogFar;         /* fim da névoa                             */

varying vec3 vNormal;
varying vec3 vFragPos;

void main() {
  vec3 norm     = normalize(vNormal);
  vec3 lightDir = normalize(uLightPos - vFragPos);
  vec3 viewDir  = normalize(uEyePos   - vFragPos);

  /* Componente difusa (Lambert) */
  float diff = max(dot(norm, lightDir), 0.0);

  /* Componente especular (Blinn-Phong) */
  vec3  halfVec = normalize(lightDir + viewDir);
  float spec    = pow(max(dot(norm, halfVec), 0.0), 64.0) * 0.45 * uSpecular;

  float d     = diff * uLightIntensity;
  float s     = spec * uLightIntensity;
  vec3 baseColor = uColor;
  if (uTreeMode > 0.5) {
    float trunkMix = smoothstep(uTreeTrunkTop - 0.90, uTreeTrunkTop + 3.20, vFragPos.y);
    trunkMix = trunkMix * trunkMix;
    vec3 trunkColor = vec3(0.28, 0.16, 0.07);
    baseColor = mix(trunkColor, uColor, trunkMix);
  }
  vec3 color = (uAmbient + d) * baseColor + s * vec3(1.0) + uEmissive;

  float distToEye = length(uEyePos - vFragPos);
  float fogF = clamp((distToEye - uFogNear) / max(0.001, (uFogFar - uFogNear)), 0.0, 1.0);
  fogF = fogF * fogF * (3.0 - 2.0 * fogF);  // smoothstep manual
  color = mix(color, uFogColor, fogF);

  gl_FragColor  = vec4(color, uAlpha);
}
`;

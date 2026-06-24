/*
  shaders.js
  Código-fonte GLSL dos shaders Vertex e Fragment usados em toda a cena.
  Implementa iluminação Blinn-Phong com suporte a textura, névoa, modo árvore e emissivos.
*/

// vertex shader
const VERT_SRC = /* glsl */`
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
uniform mat3 uNormalMat;

varying vec3 vNormal;
varying vec3 vFragPos;
varying vec2 vUV;

void main() {
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vFragPos      = worldPos.xyz;
  vNormal       = uNormalMat * aNormal;
  vUV           = aUV;
  gl_Position   = uProj * uView * worldPos;
}
`;

// fragment shader (Blinn-Phong)
const FRAG_SRC = /* glsl */`
precision mediump float;

uniform vec3  uLightPos;
  uniform vec3  uEyePos;
  uniform vec3  uColor;
  uniform float uAlpha;
  uniform sampler2D uTex;
  uniform float uUseTex;      // 1=textura, 0=cor sólida
  uniform float uUnlit;       // 1=sem iluminação
  uniform float uAmbient;
  uniform float uLightIntensity;
  uniform vec3  uEmissive;
  uniform float uSpecular;    // 0=matte, 1=brilhoso
  uniform float uTreeMode;    // 1=coloração tronco/copa
  uniform float uTreeTrunkTop;
  uniform vec3  uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

varying vec3 vNormal;
varying vec3 vFragPos;
varying vec2 vUV;

void main() {
  vec4 texel = vec4(1.0);
  if (uUseTex > 0.5) {
    texel = texture2D(uTex, vUV);
  }

  vec3 norm     = normalize(vNormal);
  vec3 lightDir = normalize(uLightPos - vFragPos);
  vec3 viewDir  = normalize(uEyePos   - vFragPos);

  // difusa (Lambert)
  float diff = max(dot(norm, lightDir), 0.0);

  // especular (Blinn-Phong)
  vec3  halfVec = normalize(lightDir + viewDir);
  float spec    = pow(max(dot(norm, halfVec), 0.0), 64.0) * 0.45 * uSpecular;

  float d     = diff * uLightIntensity;
  float s     = spec * uLightIntensity;
  vec3 baseColor = uColor * texel.rgb;
  float alpha    = uAlpha * texel.a;
  if (uTreeMode > 0.5) {
    vec3 trunkColor = vec3(0.28, 0.16, 0.07);
    // separa tronco de copa
    float isLeaf = step(uTreeTrunkTop + 1.20, vFragPos.y);
    baseColor = mix(trunkColor, uColor, isLeaf);
  }
  vec3 color;
  if (uUnlit > 0.5) {
    color = baseColor + uEmissive;
  } else {
    color = (uAmbient + d) * baseColor + s * vec3(1.0) + uEmissive;
  }

  float distToEye = length(uEyePos - vFragPos);
  float fogF = clamp((distToEye - uFogNear) / max(0.001, (uFogFar - uFogNear)), 0.0, 1.0);
  fogF = fogF * fogF * (3.0 - 2.0 * fogF);  // smoothstep manual
  color = mix(color, uFogColor, fogF);

  gl_FragColor  = vec4(color, alpha);
}
`;

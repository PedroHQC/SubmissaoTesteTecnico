// Wake trail vertex shader
// Faixa triangulada atrás do barco: posição em mundo, UV (u = largura, v = ao longo) e alpha por vértice.

in vec2 aPosition;
in vec2 aUV;
in float aAlpha;

out vec2 vUV;
out float vAlpha;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);

  vUV = aUV;
  vAlpha = aAlpha;
}

// Water vertex shader
// Quad cobrindo a região do mapa (em pixels de mundo); repassa a posição de mundo para o fragment.

in vec2 aPosition;

out vec2 vWorldPos;
out vec2 vShoreUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

uniform vec2 uMapSize;
uniform vec2 uRegionOrigin;

void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);

  vWorldPos = aPosition;
  vShoreUV = (aPosition - uRegionOrigin) / uMapSize;
}

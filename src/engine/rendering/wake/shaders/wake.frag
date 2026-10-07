// Wake trail fragment shader
// Textura (u = através do rastro, v = ao longo, repetindo) × tint × alpha do vértice.
// A textura chega com alpha pré-multiplicado (padrão do Pixi), então tudo é multiplicado junto.

in vec2 vUV;
in float vAlpha;

out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec3 uTint;
uniform float uOpacity;
uniform float uScroll;

void main() {
  vec4 color = texture(uTexture, vec2(vUV.x, vUV.y + uScroll));
  finalColor = vec4(color.rgb * uTint, color.a) * (vAlpha * uOpacity);
}

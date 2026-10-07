// Water fragment shader (top-down 2D)
//
// Pipeline:
//   0. Profundidade: fbm procedural (4 oitavas) mapeado num gradiente
//      fundo → raso, com contorno claro na transição. É a camada de baixo.
//  0b. Ilhas: o campo de distância da costa (ondulado pelo noise) força raso e
//      "muito raso" em volta das ilhas, antes da superfície.
//   1. Superfície: duas amostras da textura base com rolagem, rotação e escala
//      diferentes + distorção senoidal, composta sobre a profundidade com modo de mistura e
//      opacidade interpolada entre fundo e raso (toggle uSurfaceEnabled).
//   2. Brilho: onde as cristas claras das duas camadas coincidem.
//   3. Costa: campo de distância (R = 0 na terra, 1 em mar aberto) controla
//      a cor de água rasa e as faixas de espuma que avançam para a praia.
//
// Custo: 1–3 amostras de textura, 4 oitavas de value noise e poucas trigonométricas por pixel.

in vec2 vWorldPos;
in vec2 vShoreUV;

out vec4 finalColor;

uniform sampler2D uWaterTexture;
uniform sampler2D uShoreField;

uniform float uTime;

uniform float uDepthNoiseScale;
uniform vec2 uDepthNoiseDrift;
uniform float uDepthThreshold;
uniform float uDepthSoftness;
uniform vec3 uDeepColor;
uniform vec3 uShallowNoiseColor;
uniform float uDepthEdgeStrength;
uniform float uDepthEdgeWidth;

uniform float uShoreFieldRange;
uniform float uShoreDistanceTiles;
uniform float uIslandShallowStrength;
uniform float uIslandShallowRange;
uniform float uIslandShallowSoftness;
uniform float uIslandNoiseDistort;
uniform vec3 uVeryShallowColor;
uniform float uVeryShallowStrength;
uniform float uVeryShallowRange;
uniform float uVeryShallowSoftness;
uniform float uVeryShallowSurfaceFade;
uniform float uSurfaceBlendMode;
uniform float uSurfaceOpacityDeep;
uniform float uSurfaceOpacityShallow;

uniform float uSurfaceEnabled;
uniform float uTextureScale;
uniform vec2 uScrollA;
uniform vec2 uScrollB;
uniform float uDistortionStrength;
uniform float uDistortionFrequency;
uniform float uDistortionSpeed;
uniform float uHighlightStrength;

uniform vec3 uDeepTint;
uniform vec3 uShallowColor;
uniform float uShallowStrength;

uniform vec3 uFoamColor;
uniform float uFoamStrength;
uniform float uFoamBands;
uniform float uFoamSpeed;
uniform float uFoamWidth;

// Rotação fixa da camada B (~37°) para desalinhar as repetições
const mat2 LAYER_B_ROTATION = mat2(0.7986, -0.6018, 0.6018, 0.7986);
const float LAYER_B_SCALE = 0.73;

float luminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

// --- Value noise + fbm (sem texturas) ---
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * valueNoise(p);
    p = p * 2.03 + 17.0;
    amplitude *= 0.5;
  }
  return value / 0.9375; // normaliza a soma das amplitudes para 0..1
}

// --- Modos de mistura (base = profundidade, blend = superfície) ---
// Índices batem com SURFACE_BLEND_MODES em WaterConfig.ts
vec3 blendOverlay(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}

vec3 blendSoftLight(vec3 base, vec3 blend) {
  return mix(
    base - (1.0 - 2.0 * blend) * base * (1.0 - base),
    base + (2.0 * blend - 1.0) * (sqrt(max(base, 0.0)) - base),
    step(0.5, blend)
  );
}

vec3 blendSurface(vec3 base, vec3 blend, float mode) {
  if (mode < 0.5) return blend;                                  // 0 Normal
  if (mode < 1.5) return base * blend;                           // 1 Multiply
  if (mode < 2.5) return 1.0 - (1.0 - base) * (1.0 - blend);     // 2 Screen
  if (mode < 3.5) return blendOverlay(base, blend);              // 3 Overlay
  if (mode < 4.5) return blendSoftLight(base, blend);            // 4 Soft Light
  return base + (luminance(blend) - 0.5);                        // 5 Detail: só o relevo da textura
}

vec2 flowDistortion(vec2 worldPos, float time) {
  float f = uDistortionFrequency;
  float t = time * uDistortionSpeed;

  return vec2(
    sin(worldPos.y * f + t) + sin(worldPos.x * f * 0.7 - t * 1.3),
    cos(worldPos.x * f + t * 0.9) + cos(worldPos.y * f * 0.8 + t * 1.1)
  ) * (0.5 * uDistortionStrength);
}

void main() {
  vec2 warp = flowDistortion(vWorldPos, uTime);

  // Distância até a ilha em tiles (o campo guarda 0..1 sobre uShoreFieldRange tiles)
  float shoreTiles = texture(uShoreField, vShoreUV).r * uShoreFieldRange;

  // --- 0. Profundidade procedural (camada de baixo) ---
  float depthNoise = fbm((vWorldPos + uDepthNoiseDrift * uTime) / uDepthNoiseScale);
  float noiseShallow = smoothstep(
    uDepthThreshold - uDepthSoftness,
    uDepthThreshold + uDepthSoftness,
    depthNoise
  );

  // --- 0b. Raso em volta das ilhas ---
  // O mesmo noise ondula o contorno para não seguir a grade de tiles
  float islandTiles = shoreTiles + (depthNoise - 0.5) * uIslandNoiseDistort;
  float islandShallow = uIslandShallowStrength * (1.0 - smoothstep(
    uIslandShallowRange - uIslandShallowSoftness,
    uIslandShallowRange + uIslandShallowSoftness,
    islandTiles
  ));
  float veryShallow = uVeryShallowStrength * (1.0 - smoothstep(
    uVeryShallowRange - uVeryShallowSoftness,
    uVeryShallowRange + uVeryShallowSoftness,
    islandTiles
  ));

  float shallowMask = max(noiseShallow, islandShallow);
  vec3 water = mix(uDeepColor, uShallowNoiseColor, shallowMask);
  water = mix(water, uVeryShallowColor, veryShallow);

  float edge = 1.0 - smoothstep(0.0, uDepthEdgeWidth, abs(depthNoise - uDepthThreshold));
  water += edge * uDepthEdgeStrength;

  // --- 1/2. Superfície + brilho (opcional; desligada não amostra a textura) ---
  if (uSurfaceEnabled > 0.5) {
    vec2 baseUV = vWorldPos / uTextureScale;
    vec2 uvA = baseUV + (uScrollA * uTime) / uTextureScale + warp;
    vec2 uvB = LAYER_B_ROTATION * baseUV * LAYER_B_SCALE + (uScrollB * uTime) / uTextureScale - warp;

    vec3 layerA = texture(uWaterTexture, uvA).rgb;
    vec3 layerB = texture(uWaterTexture, uvB).rgb;

    vec3 surface = mix(layerA, layerB, 0.5) * uDeepTint;
    float surfaceOpacity = mix(uSurfaceOpacityDeep, uSurfaceOpacityShallow, shallowMask);
    surfaceOpacity *= 1.0 - veryShallow * uVeryShallowSurfaceFade;
    water = mix(water, blendSurface(water, surface, uSurfaceBlendMode), surfaceOpacity);

    float crest = smoothstep(0.7, 1.0, min(luminance(layerA), luminance(layerB)));
    water += crest * uHighlightStrength;
  }

  // --- 3. Costa ---
  float shoreDistance = clamp(shoreTiles / uShoreDistanceTiles, 0.0, 1.0);
  float shallow = 1.0 - smoothstep(0.0, 1.0, shoreDistance);

  water = mix(water, uShallowColor + (water - 0.5) * 0.35, shallow * uShallowStrength);

  // Fase cresce com a distância e com o tempo: as faixas viajam rumo à costa
  float phase = shoreDistance * uFoamBands + uTime * uFoamSpeed + warp.x * 4.0;
  float wave = abs(fract(phase) - 0.5) * 2.0;
  float foam = smoothstep(1.0 - uFoamWidth, 1.0, wave) * shallow * shallow;

  water = mix(water, uFoamColor, foam * uFoamStrength);

  finalColor = vec4(water, 1.0);
}

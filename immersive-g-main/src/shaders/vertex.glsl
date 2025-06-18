uniform sampler2D touchTexture, autoTouchTexture;
uniform float opacity;

varying vec2 vUv, uvScreen;
varying vec4 flowmap;
varying float extrude;

void main() {
  vUv = uv;

  vec4 worldPosition = modelMatrix * vec4(position, 1.);
  vec4 ndc = projectionMatrix * viewMatrix * worldPosition;
  uvScreen = (ndc.xy / ndc.w + 1.) * .5;

  flowmap = texture2D(touchTexture, uvScreen) + texture2D(autoTouchTexture, uvScreen);
  extrude = flowmap.b * opacity;

  worldPosition.xyz *= vec3(1.004, 1.004, mix(.05, 1., extrude));

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}

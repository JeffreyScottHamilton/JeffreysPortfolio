/** GPU point sprites: original sample positions stay immutable; only dots move. */
export type ParticleFrame = {
  time: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  strength: number;
  radius: number;
  trails: Float32Array;
};
export type ParticleRenderer = {
  upload(data: Float32Array, width: number, height: number, dpr: number): void;
  paint(frame: ParticleFrame): void;
  clear(): void;
  dispose(): void;
};
export const particleGlyphs = "AqKz74%#?01+:x";
export const spriteSize = 32;
export function makeParticleAtlas() {
  const atlas = document.createElement("canvas");
  atlas.width = spriteSize * 16;
  atlas.height = spriteSize;
  const c = atlas.getContext("2d");
  if (!c) return atlas;
  c.fillStyle = "#fff";
  c.beginPath();
  c.arc(16, 16, 15, 0, Math.PI * 2);
  c.fill();
  c.font = "30px monospace";
  c.textBaseline = "middle";
  c.textAlign = "center";
  for (let i = 0; i < particleGlyphs.length; i++)
    c.fillText(particleGlyphs[i], (i + 1.5) * spriteSize, 17);
  return atlas;
}
const vertex = `
precision highp float;
attribute vec2 a_home;
attribute float a_size;
attribute float a_alpha;
attribute float a_glyph;
attribute float a_seed;
uniform vec2 u_resolution;
uniform float u_dpr;
uniform float u_time;
uniform vec2 u_pointer;
uniform vec2 u_velocity;
uniform float u_strength;
uniform float u_radius;
uniform vec3 u_trails[8];
varying float v_alpha;
varying float v_glyph;
varying float v_motion;
void main() {
  vec2 delta = a_home - u_pointer;
  float distance = length(delta);
  float reach = 1.0 - smoothstep(u_radius * .25, u_radius * 2.0, distance);
  vec2 direction = delta / max(distance, 1.0);
  float swirl = sin(a_seed * 12.0 + u_time * .65);
  vec2 tangent = vec2(-direction.y, direction.x);
  vec2 force = (direction * u_radius * .43 + tangent * (12.0 + 10.0 * swirl)) * reach * u_strength;
  force -= clamp(u_velocity, vec2(-800.0), vec2(800.0)) * .027 * reach * u_strength;
  for (int i = 0; i < 8; i++) {
    vec2 wake = a_home - u_trails[i].xy;
    float distanceToWake = length(wake);
    float flow = (1.0 - smoothstep(u_radius * .3, u_radius * 1.7, distanceToWake)) * u_trails[i].z;
    vec2 curl = vec2(-wake.y, wake.x) / max(distanceToWake, 1.0);
    force += curl * flow * (2.0 + a_seed * 3.0);
  }
  float loose = smoothstep(.91, 1.0, a_seed);
  vec2 breathe = vec2(sin(u_time * .46 + a_seed * 19.0), cos(u_time * .38 + a_seed * 31.0)) * (.25 + a_seed * .35 + loose * 3.0);
  vec2 position = a_home + force + breathe;
  vec2 clip = position / u_resolution * 2.0 - 1.0;
  gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
  float size = a_size * u_dpr;
  gl_PointSize = max(1.0, size);
  v_alpha = a_alpha * min(1.0, size * size);
  v_glyph = a_glyph;
  v_motion = min(1.0, length(u_velocity) / 450.0) * reach * u_strength;
}`;
const fragment = `
precision mediump float;
uniform sampler2D u_atlas;
uniform vec3 u_ink;
varying float v_alpha;
varying float v_glyph;
varying float v_motion;
void main() {
  vec2 uv = vec2((floor(v_glyph + .5) + gl_PointCoord.x) / 16.0, gl_PointCoord.y);
  float alpha = texture2D(u_atlas, uv).a * v_alpha;
  if (alpha < .005) discard;
  vec3 fringe = vec3(.14, -.025, -.09) * (gl_PointCoord.x - .5) * v_motion;
  vec3 color = clamp(u_ink + fringe, 0.0, 1.0);
  gl_FragColor = vec4(color * alpha, alpha);
}`;
export function createParticleRenderer(
  canvas: HTMLCanvasElement,
  atlas: HTMLCanvasElement,
  light: boolean,
): ParticleRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null,
    buffer: WebGLBuffer | null = null,
    texture: WebGLTexture | null = null;
  try {
    for (const [kind, text] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error("Shader unavailable");
      shaders.push(shader);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("Particle shader unavailable");
    }
    program = gl.createProgram();
    if (!program) throw new Error("Program unavailable");
    shaders.forEach((s) => gl.attachShader(program!, s));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Particle program unavailable");
    buffer = gl.createBuffer();
    texture = gl.createTexture();
    if (!buffer || !texture) throw new Error("Particle buffers unavailable");
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const attributes = [
      ["a_home", 2, 0],
      ["a_size", 1, 2],
      ["a_alpha", 1, 3],
      ["a_glyph", 1, 4],
      ["a_seed", 1, 5],
    ] as const;
    for (const [name, count, offset] of attributes) {
      const a = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, count, gl.FLOAT, false, 24, offset * 4);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    const uniforms = Object.fromEntries(
      [
        "u_resolution",
        "u_dpr",
        "u_time",
        "u_pointer",
        "u_velocity",
        "u_strength",
        "u_radius",
        "u_trails[0]",
        "u_atlas",
        "u_ink",
      ].map((name) => [name, gl.getUniformLocation(program!, name)]),
    );
    gl.uniform1i(uniforms.u_atlas, 0);
    gl.uniform3f(
      uniforms.u_ink,
      ...((light ? [0.078, 0.078, 0.07] : [0.973, 0.969, 0.937]) as [
        number,
        number,
        number,
      ]),
    );
    let count = 0,
      destroyed = false;
    return {
      upload(data, w, h, dpr) {
        if (destroyed) return;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        count = data.length / 6;
        gl.uniform2f(uniforms.u_resolution, w, h);
        gl.uniform1f(uniforms.u_dpr, dpr);
      },
      paint(f) {
        if (destroyed || gl.isContextLost()) return;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uniforms.u_time, f.time / 1000);
        gl.uniform2f(uniforms.u_pointer, f.x, f.y);
        gl.uniform2f(uniforms.u_velocity, f.vx, f.vy);
        gl.uniform1f(uniforms.u_strength, f.strength);
        gl.uniform1f(uniforms.u_radius, f.radius);
        gl.uniform3fv(uniforms["u_trails[0]"], f.trails);
        gl.drawArrays(gl.POINTS, 0, count);
      },
      clear() {
        if (!destroyed) gl.clear(gl.COLOR_BUFFER_BIT);
      },
      dispose() {
        if (destroyed) return;
        destroyed = true;
        gl.deleteBuffer(buffer);
        gl.deleteTexture(texture);
        gl.deleteProgram(program);
        shaders.forEach((s) => gl.deleteShader(s));
      },
    };
  } catch {
    shaders.forEach((s) => gl.deleteShader(s));
    if (buffer) gl.deleteBuffer(buffer);
    if (texture) gl.deleteTexture(texture);
    if (program) gl.deleteProgram(program);
    return null;
  }
}

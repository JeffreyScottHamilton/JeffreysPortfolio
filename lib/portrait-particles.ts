/** GPU point sprites: original sample positions stay immutable; only dots move. */
export type ParticleFrame = {
  time: number;
  formation: number;
  scatter: number;
  offsets: Float32Array;
  pointer: [number, number, number];
};
export type ParticleRenderer = {
  upload(
    data: Float32Array,
    width: number,
    height: number,
    dpr: number,
    light: boolean,
  ): void;
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
attribute vec2 a_offset;
attribute vec3 a_rgb;
attribute float a_size;
attribute float a_alpha;
attribute float a_glyph;
attribute float a_seed;
uniform vec2 u_resolution;
uniform float u_dpr;
uniform float u_time;
uniform float u_formation;
uniform float u_scatter;
uniform vec3 u_pointer;

varying float v_alpha;
varying float v_glyph;
varying float v_motion;
varying vec3 v_rgb;
varying float v_tint;
void main(){
 vec2 uv=a_home/u_resolution;
 vec2 force=a_offset;
 float boundary=min(1.0,length(force)/65.0);
 float face=smoothstep(.20,.30,uv.y)*(1.0-smoothstep(.54,.62,uv.y))*smoothstep(.24,.34,uv.x)*(1.0-smoothstep(.67,.77,uv.x));
 float amplitude=mix(a_glyph>.5?3.0+a_seed*5.0:.8+a_seed*1.2,.12,face);
 vec2 breathe=vec2(sin(u_time*.50+uv.y*5.0+a_seed),cos(u_time*.43+uv.x*6.0+a_seed))*amplitude;
 float formed=smoothstep(0.0,1.0,u_formation);
 vec2 dispersed=a_home+vec2(cos(a_seed*25.0)*(.2+a_seed)*u_resolution.x,sin(a_seed*19.0)*u_resolution.y*.48+u_resolution.y*.25);
 vec2 position=mix(dispersed,a_home,formed)+vec2(sin(a_seed*9.0)*80.0,-60.0)*sin(formed*3.14159)+breathe+force;
 position+=vec2(sin(uv.y*7.0+a_seed)*u_scatter*22.0,cos(uv.x*5.0+a_seed)*u_scatter*14.0);
 vec2 clip=position/u_resolution*2.0-1.0;
 gl_Position=vec4(clip*vec2(1.0,-1.0),0.0,1.0);
 float size=a_size*u_dpr*mix(1.6,1.0,formed);
 gl_PointSize=max(1.0,size);
 v_alpha=a_alpha*min(1.0,size*size)*(.12+.88*formed);
 v_glyph=a_glyph;v_motion=boundary;
 v_rgb=a_rgb;
 float proximity=1.0-smoothstep(18.0,125.0,length(position-u_pointer.xy));
 v_tint=clamp(proximity*u_pointer.z*.95+min(.55,length(force)/100.0),0.0,1.0)*formed;
}`;
const fragment = `
precision mediump float;
uniform sampler2D u_atlas;
uniform vec3 u_ink;
uniform float u_fullColor;
varying float v_alpha;
varying float v_glyph;
varying float v_motion;
varying vec3 v_rgb;
varying float v_tint;
void main() {
  vec2 uv = vec2((floor(v_glyph + .5) + gl_PointCoord.x) / 16.0, gl_PointCoord.y);
  float alpha = texture2D(u_atlas, uv).a * v_alpha;
  if (alpha < .005) discard;
  vec3 fringe = vec3(.14, -.025, -.09) * (gl_PointCoord.x - .5) * v_motion;
  // Point size already encodes photographic luminance. Preserve that shading once,
  // while adding original chromaticity instead of multiplying dark pixels twice.
  float peak=max(.08,max(v_rgb.r,max(v_rgb.g,v_rgb.b)));
  vec3 tintedInk=v_rgb/peak*.94;
  vec3 color = clamp(mix(mix(u_ink,tintedInk,v_tint),v_rgb,u_fullColor) + fringe, 0.0, 1.0);
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
    texture: WebGLTexture | null = null,
    motionBuffer: WebGLBuffer | null = null;
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
    motionBuffer = gl.createBuffer();
    if (!buffer || !texture || !motionBuffer)
      throw new Error("Particle buffers unavailable");
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const attributes = [
      ["a_home", 2, 0],
      ["a_size", 1, 2],
      ["a_alpha", 1, 3],
      ["a_glyph", 1, 4],
      ["a_seed", 1, 5],
      ["a_rgb", 3, 6],
    ] as const;
    for (const [name, count, offset] of attributes) {
      const a = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, count, gl.FLOAT, false, 36, offset * 4);
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
    gl.bindBuffer(gl.ARRAY_BUFFER, motionBuffer);
    const offsetLocation = gl.getAttribLocation(program, "a_offset");
    gl.enableVertexAttribArray(offsetLocation);
    gl.vertexAttribPointer(offsetLocation, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(
      [
        "u_resolution",
        "u_dpr",
        "u_time",
        "u_formation",
        "u_scatter",
        "u_pointer",
        "u_atlas",
        "u_ink",
        "u_fullColor",
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
      upload(data, w, h, dpr, light) {
        if (destroyed) return;
        gl.uniform1f(uniforms.u_fullColor, light ? 1 : 0);
        if (canvas.width !== Math.round(w * dpr))
          canvas.width = Math.round(w * dpr);
        if (canvas.height !== Math.round(h * dpr))
          canvas.height = Math.round(h * dpr);
        gl.uniform3f(
          uniforms.u_ink,
          ...((light ? [0.078, 0.078, 0.07] : [0.973, 0.969, 0.937]) as [
            number,
            number,
            number,
          ]),
        );
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        count = data.length / 9;
        gl.bindBuffer(gl.ARRAY_BUFFER, motionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, count * 8, gl.DYNAMIC_DRAW);
        gl.uniform2f(uniforms.u_resolution, w, h);
        gl.uniform1f(uniforms.u_dpr, dpr);
      },
      paint(f) {
        if (destroyed || gl.isContextLost()) return;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uniforms.u_time, f.time / 1000);
        gl.uniform1f(uniforms.u_formation, f.formation);
        gl.uniform1f(uniforms.u_scatter, f.scatter);
        gl.uniform3f(uniforms.u_pointer, ...f.pointer);
        gl.bindBuffer(gl.ARRAY_BUFFER, motionBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, f.offsets);
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
        gl.deleteBuffer(motionBuffer);
        gl.deleteProgram(program);
        shaders.forEach((s) => gl.deleteShader(s));
      },
    };
  } catch {
    shaders.forEach((s) => gl.deleteShader(s));
    if (buffer) gl.deleteBuffer(buffer);
    if (texture) gl.deleteTexture(texture);
    if (motionBuffer) gl.deleteBuffer(motionBuffer);
    if (program) gl.deleteProgram(program);
    return null;
  }
}

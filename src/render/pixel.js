// Pixel look (Settings → Pixel look). The finished 2D frame is uploaded to a WebGL canvas laid over it and redrawn
// in two passes:
//   1. shrink to the virtual resolution with a 4-tap filter that keeps most of the brightest tap, so 1px neon lines
//      survive as solid pixels instead of greying out;
//   2. blow it back up by a whole number of device pixels per virtual pixel (nearest neighbour), so every pixel is the
//      same size with hard edges. Fractional scales were what made the picture read as fuzzy.
// The virtual width is whatever whole-number pixel size lands closest to PIXEL_W across the screen.
// The HUD and floating numbers draw on a crisp canvas above this one (main.js), so in-game text stays legible.
// retroFonts() swaps the menu fonts for pixel faces to match. The 2D canvas stays underneath at opacity 0 so it keeps
// receiving pointer input. No WebGL → the setting is a no-op.

import { profile } from '../core/storage.js';

export const PIXEL_W = 360; // target virtual pixels across (the playfield is 450 units wide: ~1.25 units per pixel)

const VS = `attribute vec2 p; varying vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// Pass 1, drawn into the lowW × lowH target: one fragment per virtual pixel, sampled from the cell of the frame it covers
// (rows counted from the top, so any leftover device pixels fall off the bottom/right edge, never the HUD side).
const PRECISION = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n'; // device-pixel coordinates top 2048 on tall phones

const PIXEL_FS = PRECISION + `
uniform sampler2D src;
uniform vec2 low;   // virtual resolution
uniform vec2 dev;   // screen size in device pixels
uniform float size; // device pixels per virtual pixel
void main() {
  vec2 cr = vec2(floor(gl_FragCoord.x), low.y - 1.0 - floor(gl_FragCoord.y)); // column, row from the top
  vec2 c = (cr + 0.5) * size / dev;
  vec2 uv = vec2(c.x, 1.0 - c.y);
  vec2 d = vec2(size, -size) * 0.25 / dev;
  vec3 a = texture2D(src, uv + vec2(-d.x, -d.y)).rgb;
  vec3 b = texture2D(src, uv + vec2( d.x, -d.y)).rgb;
  vec3 e = texture2D(src, uv + vec2(-d.x,  d.y)).rgb;
  vec3 f = texture2D(src, uv + vec2( d.x,  d.y)).rgb;
  vec3 avg = (a + b + e + f) * 0.25;
  vec3 mx = max(max(a, b), max(e, f));
  vec3 col = mix(avg, mx, 0.85); // mostly the brightest tap: solid lines, fewer in-between edge shades
  // Cleaner pixels: the faintest glow haze around lines is eased back, and colour gets a touch more punch.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col *= mix(0.75, 1.0, smoothstep(0.03, 0.18, l));
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.12);
  gl_FragColor = vec4(col, 1.0);
}`;

// Pass 2: each device pixel shows the virtual pixel it falls in (nearest neighbour at a whole-number scale).
const SCREEN_FS = PRECISION + `
uniform sampler2D img;
uniform vec2 low;
uniform vec2 dev;
uniform float size;
void main() {
  vec2 cr = floor(vec2(gl_FragCoord.x, dev.y - gl_FragCoord.y) / size);
  gl_FragColor = vec4(texture2D(img, vec2((cr.x + 0.5) / low.x, 1.0 - (cr.y + 0.5) / low.y)).rgb, 1.0);
}`;

function makeProgram(gl, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name;
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

function makeTex(gl, filter) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// Pixel faces registered under the game's own family names, so every menu, button and HUD label switches without
// touching the stylesheet: a FontFace added later wins over the @font-face rules with the same descriptors.
// Silkscreen stands in for Orbitron (titles, buttons, numbers), Pixelify Sans for Rajdhani (body text).
let pixelFaces = null;
function retroFonts(on) {
  if (!document.fonts || typeof FontFace === 'undefined') return;
  if (!pixelFaces) {
    const url = (f) => `url(${new URL(`../fonts/${f}`, import.meta.url)}) format('woff2')`;
    pixelFaces = [
      new FontFace('Orbitron', url('silkscreen-400.woff2'), { weight: '100 599', sizeAdjust: '88%' }),
      new FontFace('Orbitron', url('silkscreen-700.woff2'), { weight: '600 1000', sizeAdjust: '88%' }),
      new FontFace('Rajdhani', url('pixelify-sans.woff2'), { weight: '100 1000', sizeAdjust: '92%' }),
    ];
  }
  for (const f of pixelFaces) {
    if (on) document.fonts.add(f);
    else document.fonts.delete(f);
  }
  Promise.all(on ? pixelFaces.map((f) => f.load().catch(() => {})) : [])
    .then(() => pixel.onFonts && pixel.onFonts())
    .catch(() => {});
}

let cv = null;
let gl = null;
let progPixel, progScreen, srcTex, lowTex, fbo;
let lowW = 0;
let lowH = 0;
let size = 1; // device pixels per virtual pixel
let ready = false;
let lost = false;

function setup() {
  gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false }) ||
    cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false });
  if (!gl) return false;
  try {
    progPixel = makeProgram(gl, PIXEL_FS);
    progScreen = makeProgram(gl, SCREEN_FS);
  } catch (err) {
    console.warn('pixel look disabled:', err);
    return false;
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  srcTex = makeTex(gl, gl.LINEAR);
  lowTex = makeTex(gl, gl.NEAREST);
  fbo = gl.createFramebuffer();
  lowW = lowH = 0;
  return true;
}

export const pixel = {
  /** 'pixel' | 'off' as drawn this frame ('off' when unsupported). */
  mode: 'off',
  /** Called once the menu fonts have swapped (main.js re-fits the open menu). */
  onFonts: null,

  /** The GL canvas (main.js stacks the crisp overlay canvas right above it). */
  get canvas() {
    return cv;
  },

  init(game) {
    cv = document.createElement('canvas');
    cv.id = 'pixel-cv';
    cv.setAttribute('aria-hidden', 'true');
    game.after(cv);
    cv.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      lost = true;
      ready = false;
    });
    cv.addEventListener('webglcontextrestored', () => {
      lost = false;
      ready = setup();
    });
    ready = setup();
  },

  /** Setting the player picked ('crt' from older saves counts as pixel), or 'off' when WebGL is missing. */
  wanted() {
    return ready && !lost && profile.settings.retro !== 'off' ? 'pixel' : 'off';
  },

  /** Size the GL canvas to the app box (CSS px) at the screen's device pixel ratio, and pick the whole-number pixel
   *  size that lands closest to PIXEL_W virtual pixels across. */
  resize(w, h, dpr) {
    if (!cv) return;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    size = Math.max(1, Math.round(cv.width / PIXEL_W));
    // Menus snap to the same grid (style.css .px-snap): --vpx is one virtual pixel in CSS px, --dpx one device pixel.
    const root = document.documentElement.style;
    root.setProperty('--vpx', `${size / dpr}px`);
    root.setProperty('--dpx', `${1 / dpr}px`);
    document.body.classList.toggle('px-hidpi', dpr >= 2);
    const lw = Math.ceil(cv.width / size);
    const lh = Math.ceil(cv.height / size);
    if (ready && (lw !== lowW || lh !== lowH)) {
      lowW = lw;
      lowH = lh;
      gl.bindTexture(gl.TEXTURE_2D, lowTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lowW, lowH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lowTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  },

  /** Draw the finished 2D frame through the filter (or hide the GL layer when off). Returns true when the mode
   *  changed this frame (main.js re-runs layout so the 2D canvas resolution follows). */
  present(src) {
    const mode = this.wanted();
    let changed = false;
    if (mode !== this.mode) {
      this.mode = mode;
      changed = true;
      document.body.classList.toggle('retro-pixel', mode !== 'off');
      retroFonts(mode !== 'off');
    }
    if (mode === 'off' || !lowH) return changed;

    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, lowW, lowH);
    gl.useProgram(progPixel.p);
    gl.uniform1i(progPixel.u.src, 0);
    gl.uniform2f(progPixel.u.low, lowW, lowH);
    gl.uniform2f(progPixel.u.dev, cv.width, cv.height);
    gl.uniform1f(progPixel.u.size, size);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.bindTexture(gl.TEXTURE_2D, lowTex);
    gl.useProgram(progScreen.p);
    gl.uniform1i(progScreen.u.img, 0);
    gl.uniform2f(progScreen.u.low, lowW, lowH);
    gl.uniform2f(progScreen.u.dev, cv.width, cv.height);
    gl.uniform1f(progScreen.u.size, size);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return changed;
  },
};

// Retro screen pass (Settings → Retro look). The finished 2D frame is uploaded to a WebGL canvas laid over it and
// redrawn in two passes:
//   1. pixel: shrink to a fixed virtual resolution (PIXEL_W wide) with a 4-tap filter that keeps the brightest of
//      the taps partly, so 1px neon lines survive as solid pixels instead of greying out;
//   2. screen: upscale with sharp-bilinear (crisp square pixels at any scale), then, in CRT mode, a gentle tube
//      bend, a faint shadow mask, slight RGB fringing at the edges, line warble with a slow rolling tracking band and
//      a vignette. PIXEL mode runs pass 2 flat.
// Scanlines, tube corners, glare and the roll bar live in the CSS glass layer (style.css .crt-glass) above everything,
// so the HTML menus sit on the same tube as the game; retroFonts() swaps the menu fonts for pixel faces to match.
// The 2D canvas stays underneath at opacity 0 so it keeps receiving pointer input; warp() maps a screen point to the
// spot the tube shows there, for the mouse/touch mapping in input.js. No WebGL → the setting is a no-op.

import { profile } from '../core/storage.js';

export const PIXEL_W = 320; // virtual pixels across (the playfield is 450 units wide: 1 pixel ≈ 1.4 units: a modern indie density)
const CURVE = 0.015; // barrel bend at the edges (kept gentle: the HTML menus on top can't bend)
const CORNER = 0.03; // tube corner radius (fraction of the short side)

const VS = `attribute vec2 p; varying vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const PIXEL_FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D src;
uniform vec2 cell; // one virtual pixel in source uv
void main() {
  vec2 d = cell * 0.25;
  vec3 a = texture2D(src, uv + vec2(-d.x, -d.y)).rgb;
  vec3 b = texture2D(src, uv + vec2( d.x, -d.y)).rgb;
  vec3 c = texture2D(src, uv + vec2(-d.x,  d.y)).rgb;
  vec3 e = texture2D(src, uv + vec2( d.x,  d.y)).rgb;
  vec3 avg = (a + b + c + e) * 0.25;
  vec3 mx = max(max(a, b), max(c, e));
  vec3 col = mix(avg, mx, 0.55);
  // A touch of contrast and saturation so the reduced image stays punchy.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.12);
  gl_FragColor = vec4(col, 1.0);
}`;

const SCREEN_FS = `precision mediump float;
varying vec2 uv;
uniform sampler2D img;
uniform vec2 res;   // virtual resolution
uniform vec2 outPx; // output size in device pixels
uniform float time;
uniform float curve, corner, scan, warble, roll, chroma, mask, vig, flick;

vec2 bend(vec2 q) {
  vec2 c = q * 2.0 - 1.0;
  c *= 1.0 + curve * (c.yx * c.yx);
  return c * 0.5 + 0.5;
}

// Sharp bilinear: hard pixel edges with a one-device-pixel blend, so non-integer scales don't shimmer.
vec3 tap(vec2 q) {
  vec2 p = q * res;
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 s = outPx / res;
  f = clamp((f - 0.5) * s + 0.5, 0.0, 1.0);
  return texture2D(img, (i + f) / res).rgb;
}

void main() {
  vec2 q = bend(uv);
  // Rounded tube edge: outside the glass is the black bezel.
  vec2 e = min(q, 1.0 - q);
  vec2 aspect = vec2(outPx.x / min(outPx.x, outPx.y), outPx.y / min(outPx.x, outPx.y));
  vec2 k = max(vec2(corner) - e * aspect, 0.0);
  float edge = corner - length(k);
  float inside = corner > 0.0 ? smoothstep(0.0, 1.5 / min(outPx.x, outPx.y), edge) * step(0.0, min(e.x, e.y)) : 1.0;
  if (inside <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  // Warble: each scan row drifts sideways a little; a slow tracking band rolls down the tube and kinks harder.
  float row = floor(q.y * res.y);
  float band = fract(q.y * 0.9 + time * 0.045);
  float bandK = smoothstep(0.0, 0.06, band) * (1.0 - smoothstep(0.06, 0.13, band));
  float wob = sin(row * 0.61 + time * 7.3) * 0.08 + sin(q.y * 9.0 - time * 1.7) * 0.1;
  wob += bandK * roll * (0.6 + 0.4 * sin(row * 2.3 + time * 31.0));
  q.x += warble * wob / res.x;

  // RGB fringing, growing toward the edges.
  float ca = chroma * abs(uv.x * 2.0 - 1.0) / res.x; // none in the middle, a hint at the edges
  vec3 col;
  col.r = tap(q + vec2(ca, 0.0)).r;
  col.g = tap(q).g;
  col.b = tap(q - vec2(ca, 0.0)).b;

  // Scanlines: the beam is a soft bar across each virtual row; bright rows widen it (classic bloom on the tube).
  float fy = fract(q.y * res.y) - 0.5;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float w = mix(0.17, 0.4, clamp(lum, 0.0, 1.0));
  float beam = exp(-fy * fy / (w * w * 0.5));
  // Rows only a couple of device pixels tall (1x desktop screens) would beat into moire arcs, so they get a lighter beam.
  float sk = scan * clamp((outPx.y / res.y - 1.2) / 2.0, 0.3, 1.0);
  col *= mix(1.0, beam * 1.45, sk);

  // Shadow mask: faint RGB triads on device pixels.
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 tri = vec3(m < 1.0 ? 1.0 : 0.82, (m >= 1.0 && m < 2.0) ? 1.0 : 0.82, m >= 2.0 ? 1.0 : 0.82);
  col *= mix(vec3(1.0), tri * 1.12, mask);

  col *= 1.0 + bandK * roll * 0.05;
  col *= 1.0 - flick * 0.008 * sin(time * 113.0);
  vec2 c = uv * 2.0 - 1.0;
  col *= 1.0 - vig * pow(dot(c * vec2(0.85, 0.7), c * vec2(0.85, 0.7)), 1.6);
  gl_FragColor = vec4(col * inside, 1.0);
}`;

const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

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
    .then(() => crt.onFonts && crt.onFonts())
    .catch(() => {});
}

let cv = null;
let gl = null;
let glass = null; // DOM overlay above the menus: tube corners, glare and the roll bar (style.css .crt-glass)
let progPixel, progScreen, srcTex, lowTex, fbo;
let lowW = 0;
let lowH = 0;
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
    console.warn('retro screen disabled:', err);
    return false;
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  srcTex = makeTex(gl, gl.LINEAR);
  lowTex = makeTex(gl, gl.LINEAR);
  fbo = gl.createFramebuffer();
  lowW = lowH = 0;
  return true;
}

export const crt = {
  /** 'crt' | 'pixel' | 'off' as drawn this frame ('off' when unsupported). */
  mode: 'off',
  /** Called once the menu fonts have swapped (main.js re-fits the open menu). */
  onFonts: null,

  init(app, game) {
    cv = document.createElement('canvas');
    cv.id = 'crt';
    cv.setAttribute('aria-hidden', 'true');
    game.after(cv);
    glass = document.createElement('div');
    glass.className = 'crt-glass';
    glass.innerHTML = '<i class="crt-roll"></i>';
    app.appendChild(glass);
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

  /** Setting the player picked, or 'off' when WebGL is missing. */
  wanted() {
    const s = profile.settings.retro;
    return ready && !lost && (s === 'crt' || s === 'pixel') ? s : 'off';
  },

  /** Size the GL canvas to the app box (CSS px) at the given device pixel ratio. */
  resize(w, h, dpr) {
    if (!cv) return;
    const d = Math.min(dpr, 3); // full device resolution: a resampled tube blurs the pixel edges
    cv.width = Math.round(w * d);
    cv.height = Math.round(h * d);
    const vh = Math.round((PIXEL_W * h) / w);
    // Scanline rows for the CSS glass: one per virtual pixel row. Rows only a couple of device pixels tall (1x desktop
    // screens) would beat into moire, so they get lighter lines.
    if (glass) {
      glass.style.setProperty('--crt-row', `${h / vh}px`);
      glass.style.setProperty('--crt-scan', (0.3 * Math.min(1, Math.max(0.35, ((h / vh) * dpr - 1.2) / 2))).toFixed(3));
    }
    if (ready && (vh !== lowH || lowW !== PIXEL_W)) {
      lowW = PIXEL_W;
      lowH = vh;
      gl.bindTexture(gl.TEXTURE_2D, lowTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lowW, lowH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lowTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  },

  /** Draw the finished 2D frame through the filter (or hide the GL layer when off). Returns true when the mode
   *  changed this frame (main.js re-runs layout so the 2D canvas resolution follows). */
  present(src, t) {
    const mode = this.wanted();
    let changed = false;
    if (mode !== this.mode) {
      this.mode = mode;
      changed = true;
      document.body.classList.toggle('retro-crt', mode === 'crt');
      document.body.classList.toggle('retro-pixel', mode !== 'off');
      retroFonts(mode !== 'off');
    }
    if (mode === 'off' || !lowH) return changed;
    const crtOn = mode === 'crt';
    const still = reduceMotion && reduceMotion.matches;

    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, lowW, lowH);
    gl.useProgram(progPixel.p);
    gl.uniform1i(progPixel.u.src, 0);
    gl.uniform2f(progPixel.u.cell, 1 / lowW, 1 / lowH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.bindTexture(gl.TEXTURE_2D, lowTex);
    const u = progScreen.u;
    gl.useProgram(progScreen.p);
    gl.uniform1i(u.img, 0);
    gl.uniform2f(u.res, lowW, lowH);
    gl.uniform2f(u.outPx, cv.width, cv.height);
    gl.uniform1f(u.time, t % 1000);
    gl.uniform1f(u.curve, crtOn ? CURVE : 0);
    gl.uniform1f(u.corner, crtOn ? CORNER : 0);
    gl.uniform1f(u.scan, 0); // CSS glass draws the scanlines over menus and game alike
    gl.uniform1f(u.warble, crtOn && !still ? 1 : 0);
    gl.uniform1f(u.roll, crtOn && !still ? 1 : 0);
    gl.uniform1f(u.chroma, crtOn ? 0.4 : 0);
    gl.uniform1f(u.mask, crtOn ? 0.12 : 0);
    gl.uniform1f(u.vig, crtOn ? 0.25 : 0);
    gl.uniform1f(u.flick, crtOn && !still ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return changed;
  },

  /** Screen point (0..1 across the app box) → the point of the frame the tube shows there. */
  warp(x, y) {
    if (this.mode !== 'crt') return null;
    let cx = x * 2 - 1;
    let cy = y * 2 - 1;
    const bx = cx * (1 + CURVE * cy * cy);
    const by = cy * (1 + CURVE * cx * cx);
    return { x: bx * 0.5 + 0.5, y: by * 0.5 + 0.5 };
  },
};

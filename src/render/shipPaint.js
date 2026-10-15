// Shift only the ship's chromatic stock accents. Neutral armor keeps its shading.
function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (!d) return [0, 0, l];
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, d / (1 - Math.abs(2 * l - 1)), l];
}

function hexHsl(hex) {
  return hsl(...hex.match(/[\da-f]{2}/gi).map(v => parseInt(v, 16)));
}

export function shipPaint(stock, target) {
  if (stock.toLowerCase() === target.toLowerCase()) return null;
  const [sh, ss, sl] = hexHsl(stock), [th, ts, tl] = hexHsl(target);
  return (r, g, b) => {
    const [h, s, l] = hsl(r, g, b);
    const distance = Math.min(Math.abs(h - sh), 1 - Math.abs(h - sh));
    if (s < 0.2 || Math.max(r, g, b) - Math.min(r, g, b) < 18 || distance > 0.13) return [r, g, b];
    const hue = ((h + th - sh) % 1 + 1) % 1;
    const saturation = Math.min(1, s * ts / Math.max(ss, 0.001));
    const light = l <= sl ? l * tl / Math.max(sl, 0.001) : tl + (l - sl) * (1 - tl) / Math.max(1 - sl, 0.001);
    const a = saturation * Math.min(light, 1 - light);
    const channel = n => {
      const k = (n + hue * 12) % 12;
      return Math.round(255 * (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [channel(0), channel(8), channel(4)];
  };
}

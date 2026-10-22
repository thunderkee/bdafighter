/**
 * Haptics: a short tap or a pattern of taps. Android browsers vibrate; iPhone Safari ignores
 * vibration, but (from iOS 18) it gives a real haptic click whenever a switch-style checkbox
 * flips, so a hidden one is flipped for each tap. A pattern's numbers are tap lengths in ms
 * (vibrate) or, on iPhone, one click per number, spaced by the gaps between them.
 */
let sw: HTMLLabelElement | null = null;
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
const isApple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 0;
let lastTap = 0;

function iosSwitch() {
  if (sw || !isApple) return sw;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  sw = label;
  return sw;
}

/** a single click on iPhone (at most one every 40 ms, so a stream doesn't turn into a buzz) */
function click() {
  const now = performance.now();
  if (now - lastTap < 40) return;
  lastTap = now;
  iosSwitch()?.click();
}

export function buzz(pattern: number | number[]) {
  try {
    if (canVibrate) {
      navigator.vibrate(pattern);
      return;
    }
    if (!isApple) return;
    const p = Array.isArray(pattern) ? pattern : [pattern];
    // taps on the odd entries (vibrate's on-off pairs), after the gaps before them
    let t = 0;
    for (let i = 0; i < p.length; i += 2) {
      if (t === 0) click();
      else setTimeout(click, t);
      t += p[i] + (p[i + 1] ?? 0);
    }
  } catch {
    // no haptics here
  }
}

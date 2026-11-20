// Horizontal swipe gesture for review cards (pointer events, works with touch and mouse).
// Vertical scrolling stays native thanks to `touch-action: pan-y` on the element.
import { reducedMotion } from './components.js';

export function attachSwipe(el, { onLeft, onRight, onTap, threshold = 90 } = {}) {
  let startX = 0, startY = 0, dx = 0, active = false, moved = false, id = null;

  const setHint = (v) => {
    el.dataset.swipe = v > 30 ? 'right' : v < -30 ? 'left' : '';
  };
  const reset = () => {
    el.style.transition = reducedMotion() ? 'none' : 'transform .25s cubic-bezier(.2,.8,.2,1)';
    el.style.transform = '';
    setHint(0);
  };

  const down = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button, a, input, textarea, select')) return;
    active = true; moved = false; id = e.pointerId;
    startX = e.clientX; startY = e.clientY; dx = 0;
    el.style.transition = 'none';
  };
  const move = (e) => {
    if (!active || e.pointerId !== id) return;
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { active = false; reset(); return; }
    if (Math.abs(dx) > 6) {
      if (!moved) el.setPointerCapture?.(id);
      moved = true;
    }
    if (moved) {
      el.style.transform = `translateX(${dx}px) rotate(${dx / 24}deg)`;
      setHint(dx);
    }
  };
  const up = (e) => {
    if (!active || e.pointerId !== id) return;
    active = false;
    if (!moved) { reset(); onTap?.(e); return; }
    if (dx > threshold && onRight) fling(1, onRight);
    else if (dx < -threshold && onLeft) fling(-1, onLeft);
    else reset();
  };
  const fling = (dir, cb) => {
    el.style.transition = reducedMotion() ? 'none' : 'transform .22s ease-in, opacity .22s ease-in';
    el.style.transform = `translateX(${dir * window.innerWidth}px) rotate(${dir * 18}deg)`;
    el.style.opacity = '0';
    setTimeout(cb, reducedMotion() ? 0 : 200);
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', () => { active = false; reset(); });
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
  };
}

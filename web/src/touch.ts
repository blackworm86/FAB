/** Phone helpers: swipe a bottom sheet down to close it, and long-press any button to see what it does (phones have no hover). */
const phone = () => matchMedia('(max-width: 700px)').matches;

export function initTouch(root: HTMLElement) {
  /* ---- swipe down to close a sheet ---- */
  let sheet: HTMLElement | null = null,
    y0 = 0,
    dy = 0;
  root.addEventListener(
    'touchstart',
    (e) => {
      const t0 = e.target as HTMLElement,
        s = t0.closest<HTMLElement>('.modal > .sheet') ?? (t0.closest('.chead') ? t0.closest<HTMLElement>('.chat') : null);
      if (!s || !phone() || s.scrollTop > 0) {
        sheet = null;
        return;
      }
      if ((e.target as HTMLElement).closest('input, select, textarea, .pcgrid, .chips')) {
        sheet = null;
        return;
      }
      for (let el: HTMLElement | null = e.target as HTMLElement; el && el !== s; el = el.parentElement)
        if (el.scrollTop > 0) {
          sheet = null;
          return;
        } // an inner list scrolled down: the swipe scrolls it back up
      sheet = s;
      y0 = e.touches[0].clientY;
      dy = 0;
    },
    { passive: true },
  );
  root.addEventListener(
    'touchmove',
    (e) => {
      if (!sheet) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0 && sheet.scrollTop <= 0) {
        sheet.style.transform = `translateY(${dy}px)`;
        sheet.style.transition = 'none';
      } else if (dy < 0) {
        sheet.style.transform = '';
      }
    },
    { passive: true },
  );
  root.addEventListener('touchend', () => {
    if (!sheet) return;
    const s = sheet;
    sheet = null;
    s.style.transition = 'transform .18s';
    if (dy > 90) {
      s.style.transform = 'translateY(100%)';
      setTimeout(() => s.querySelector<HTMLElement>('[aria-label="Close"], [aria-label="Close chat"], [data-modal=""]')?.click(), 160);
    } else s.style.transform = '';
  });

  /* ---- long-press: show the button's name ---- */
  let timer = 0,
    tipEl: HTMLElement | null = null,
    swallow = false;
  const hide = () => {
    tipEl?.remove();
    tipEl = null;
  };
  root.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      hide();
      const t = (e.target as HTMLElement).closest<HTMLElement>(
        'button[title], button[aria-label], [role=button][title], .chp[title], .vps',
      );
      if (!t) return;
      const text = t.getAttribute('title') || t.getAttribute('aria-label');
      if (!text) return;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        swallow = true;
        const r = t.getBoundingClientRect();
        tipEl = document.createElement('div');
        tipEl.className = 'lptip';
        tipEl.textContent = text;
        document.body.append(tipEl);
        const w = tipEl.offsetWidth,
          h = tipEl.offsetHeight,
          x = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)),
          y = r.top - h - 8 > 6 ? r.top - h - 8 : r.bottom + 8;
        tipEl.style.left = `${x}px`;
        tipEl.style.top = `${y}px`;
        navigator.vibrate?.(10);
        setTimeout(hide, 2600);
      }, 480);
    },
    true,
  );
  const cancel = () => clearTimeout(timer);
  root.addEventListener('pointerup', cancel, true);
  root.addEventListener('pointercancel', cancel, true);
  root.addEventListener(
    'pointermove',
    (e) => {
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancel();
    },
    true,
  );
  root.addEventListener(
    'click',
    (e) => {
      if (swallow) {
        swallow = false;
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  ); // a long-press only shows the name, it does not also press the button
  root.addEventListener('contextmenu', (e) => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault();
  });
}

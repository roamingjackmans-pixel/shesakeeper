// Tiny DOM helpers: h('div.class#id', attrs?, ...children), modals and toasts. Everything lives inside #stage
// (a fixed 1600×900 board scaled to the window), so modals and toasts scale with it.
type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { style?: Partial<CSSStyleDeclaration> | string };

export function h(tag: string, ...rest: (Attrs | Child)[]): HTMLElement {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(tag);
  const el = document.createElement(m?.[1] || 'div');
  for (const part of (m?.[2] || '').match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  let i = 0;
  const first = rest[0];
  if (first && typeof first === 'object' && !(first instanceof Node) && !Array.isArray(first)) {
    const a = first as Attrs;
    for (const [k, v] of Object.entries(a)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'style') {
        if (typeof v === 'string') el.setAttribute('style', v);
        else Object.assign(el.style, v);
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className += ` ${v}`;
      else if (k === 'html') el.innerHTML = String(v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
    i = 1;
  }
  const add = (c: Child): void => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  for (; i < rest.length; i++) add(rest[i] as Child);
  return el;
}

/** an element from an SVG/HTML string */
export function svg(markup: string, cls = ''): HTMLElement {
  const span = document.createElement('span');
  span.className = `svg ${cls}`.trim();
  span.innerHTML = markup;
  return span;
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function stage(): HTMLElement {
  return document.getElementById('stage')!;
}

/** a modal over everything; returns close() */
export function modal(content: HTMLElement, opts: { onClose?: () => void; wide?: boolean; locked?: boolean } = {}): () => void {
  const back = h('div.modal-back');
  const box = h(`div.modal.parchment${opts.wide ? '.wide' : ''}`, content);
  back.appendChild(box);
  let closed = false;
  const onKey = (e: KeyboardEvent): void => {
    if (e.code !== 'Escape' || e.defaultPrevented || opts.locked) return;
    const all = document.querySelectorAll('.modal-back');
    if (all[all.length - 1] !== back) return;
    e.preventDefault();
    close();
  };
  const close = (): void => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    back.remove();
    opts.onClose?.();
  };
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back && !opts.locked) close();
  });
  window.addEventListener('keydown', onKey);
  stage().appendChild(back);
  return close;
}

export function closeModals(): void {
  for (const m of document.querySelectorAll('.modal-back')) m.remove();
}

export function toast(msg: string, kind: 'ok' | 'bad' | 'gold' = 'ok', ms = 3200): void {
  let host = document.getElementById('toasts');
  if (!host) {
    host = h('div#toasts');
    stage().appendChild(host);
  }
  const t = h(`div.toast.${kind}`, msg);
  host.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 500);
}

/** a big button on the wooden UI */
export function btn(label: Child, onclick: () => void, cls = ''): HTMLButtonElement {
  return h(`button${cls ? '.' + cls.split(' ').join('.') : ''}`, { type: 'button', onclick }, label) as HTMLButtonElement;
}

/** number pad for codes on touch screens */
export function keypad(input: HTMLInputElement, onEnter?: () => void): HTMLElement {
  const max = input.maxLength > 0 ? input.maxLength : 8;
  const press = (k: string): void => {
    if (k === '⌫') input.value = input.value.slice(0, -1);
    else if (k === '✔') return onEnter?.();
    else if (input.value.length < max) input.value += k;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return h(
    'div.keypad',
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✔'].map((k) => h(`button${k === '✔' ? '.primary' : ''}`, { type: 'button', 'aria-label': k === '⌫' ? 'Delete' : k === '✔' ? 'Go' : k, onclick: () => press(k) }, k)),
  );
}

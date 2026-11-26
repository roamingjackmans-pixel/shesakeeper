import './ui/theme.css';
import { audio } from './audio/audio';
import { boot } from './app';
import { watchStage } from './ui/stage';

watchStage();
// browsers start audio on the first click or key
const unlock = (): void => audio.unlock();
window.addEventListener('pointerdown', unlock, { once: true, capture: true });
window.addEventListener('keydown', unlock, { once: true, capture: true });
document.addEventListener('contextmenu', (e) => {
  if ((e.target as HTMLElement).closest('#stage')) e.preventDefault();
});

// development only: a handle on the running game for testing from the console
if (import.meta.env.DEV) void import('./ui/runner').then((m) => ((window as unknown as { __sak: unknown }).__sak = { run: () => m.currentRun() }));

// fonts first, so canvas text is drawn in Lilita One / Fredoka from the first frame
const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
Promise.race([fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).finally(() => void boot());

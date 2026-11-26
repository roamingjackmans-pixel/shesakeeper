import './ui/theme.css';
import { audio } from './audio/audio';
import { boot } from './app';
import { watchStage } from './ui/stage';
import { currentScene } from './render/canvas';

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

// fonts first if they're quick, so canvas text starts in Lilita One / Fredoka; on a slow connection start anyway and
// redraw the cached layers (signs, name plates) once they arrive
const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
Promise.race([fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 400))]).finally(() => void boot());
void fonts?.ready.then(() => currentScene()?.resize?.());

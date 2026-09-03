import { t } from './i18n';

export function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id} in index.html`);
  return found as T;
}

export function createErrorBanner(node: HTMLElement) {
  return {
    show(error: unknown) {
      console.error(error);
      node.textContent = error instanceof Error ? error.message : String(error);
      node.hidden = false;
    },
    clear() {
      node.textContent = '';
      node.hidden = true;
    },
  };
}

/**
 * Whole-page drop target. Nested dragenter/dragleave pairs are counted so the
 * overlay doesn't flicker as the pointer crosses child elements.
 */
export function createDropZone(options: {
  overlay: HTMLElement;
  onFile: (file: File) => void;
  onReject: (message: string) => void;
}) {
  const { overlay, onFile, onReject } = options;
  let depth = 0;

  const setActive = (active: boolean) => {
    overlay.hidden = !active;
  };

  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth += 1;
    setActive(true);
  });

  window.addEventListener('dragover', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });

  window.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) setActive(false);
  });

  window.addEventListener('drop', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth = 0;
    setActive(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onReject(t('drop.notAnImage', { name: file.name }));
      return;
    }
    onFile(file);
  });
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export function createSegmentedControl(node: HTMLElement, onSelect: (value: string) => void) {
  const buttons = Array.from(node.querySelectorAll<HTMLButtonElement>('button[data-fit]'));
  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const other of buttons) other.classList.toggle('is-active', other === button);
      onSelect(button.dataset.fit ?? '');
    });
  }
}

'use client';
import { useEffect, useState } from 'react';

// The visual viewport shrinks when a phone's on-screen keyboard opens.
export function useDialogViewport(open) {
  const [height, setHeight] = useState(null);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const update = () => setHeight(Math.floor(Math.min(window.innerHeight, viewport?.height || window.innerHeight) * 0.85));
    update();
    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update);
    return () => { window.removeEventListener('resize', update); viewport?.removeEventListener('resize', update); };
  }, [open]);
  return height ? { maxHeight: `${height}px` } : undefined;
}

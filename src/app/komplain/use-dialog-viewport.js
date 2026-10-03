'use client';
import { useEffect, useState } from 'react';

// The visual viewport shrinks when a phone's on-screen keyboard opens.
export function useDialogViewport(open) {
  const [layout, setLayout] = useState(null);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const update = () => {
      const height = Math.min(window.innerHeight, viewport?.height || window.innerHeight);
      const offset = viewport?.offsetTop || 0;
      const lift = window.matchMedia('(max-width: 639px)').matches ? 12 : 0;
      setLayout({ maxHeight: `${Math.floor(height * 0.85)}px`, top: `${offset + height / 2 - lift}px` });
    };
    update();
    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    return () => { window.removeEventListener('resize', update); viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update); };
  }, [open]);
  return layout || undefined;
}

'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

const GrowingTextarea = forwardRef(function GrowingTextarea({ value, className = '', onFocus, ...rest }, ref) {
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea
    ref={innerRef}
    value={value}
    className={`${className} overflow-hidden transition-[height] duration-150 ease-out`}
    onFocus={(event) => {
      onFocus?.(event);
      window.setTimeout(() => { event.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250);
    }}
    {...rest}
  />;
});

export default GrowingTextarea;

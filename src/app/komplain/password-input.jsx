'use client';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordInput({ className = '', disabled, visibilityLabel = 'password', ...props }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <input {...props} disabled={disabled} type={visible ? 'text' : 'password'} className={`${className} pr-14`} />
      <button type="button" disabled={disabled} aria-controls={props.id} aria-pressed={visible} aria-label={`${visible ? 'Sembunyikan' : 'Tampilkan'} ${visibilityLabel}`} onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-1 my-auto flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-40">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  );
}

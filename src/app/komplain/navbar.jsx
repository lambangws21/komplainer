'use client';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { RefreshCw, LogOut, ChevronDown, UserCog, Bell, Inbox } from 'lucide-react';
import RoleBadge from './role-badge';
import InfoPanel from './info-panel';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50';

export default function Navbar({ user, tab, setTab, loading, busy, loggingOut, onRefresh, onLogout, newButtonRef, masterButtonRef, unreadItems = [], formatDate, onOpenNotification, onMarkAllRead }) {
  const showNav = user && user.approval !== 'pending' && user.approval !== 'rejected' && !user.mustChangePassword;
  const tabs = [['form', 'Input laporan'], ['table', user?.role === 'admin' ? 'Data Master' : 'Tugas & laporan saya'], ...(user?.role === 'admin' ? [['users', 'Pengguna']] : [])];
  const unreadCount = unreadItems.length;
  return <header className="sticky top-0 z-30 -mx-3 -mt-4 border-b border-slate-800 bg-slate-900/95 px-3 py-4 backdrop-blur sm:-mx-8 sm:-mt-8 sm:px-8">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-300">Monitoring lapangan</p><h1 className="text-xl font-bold sm:text-2xl">Laporan Komplain</h1></div>
      <div className="flex items-center gap-2">
        <InfoPanel />
        {showNav && <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button aria-label={`Notifikasi laporan baru${unreadCount ? `, ${unreadCount} belum dibuka` : ''}`} className={`${buttonClass} relative border border-slate-700 bg-slate-800 px-3`}>
            <Bell aria-hidden="true" className="h-5 w-5" />
            {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button></DropdownMenu.Trigger>
          <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-80 max-w-[90vw] rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5"><p className="text-sm font-semibold">Laporan belum dibuka</p>{unreadCount > 0 && <DropdownMenu.Item onSelect={onMarkAllRead} className="cursor-pointer text-xs font-semibold text-blue-300 outline-none hover:underline">Tandai semua dibaca</DropdownMenu.Item>}</div>
            <DropdownMenu.Separator className="my-1 h-px bg-slate-800" />
            {unreadCount === 0 ? <p className="px-2 py-3 text-sm text-slate-400">Tidak ada laporan baru.</p> : <div className="max-h-80 space-y-1 overflow-y-auto">{unreadItems.map((item) => <DropdownMenu.Item key={item.id} onSelect={() => onOpenNotification(item)} className="flex cursor-pointer flex-col gap-0.5 rounded-lg px-2 py-2 text-sm outline-none hover:bg-slate-800 focus:bg-slate-800">
              <span className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5 truncate font-semibold"><Inbox aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-blue-300" />{item.dokter || 'Dokter tidak tersedia'}</span><span className="shrink-0 text-xs text-slate-400">{formatDate(item.tanggal)}</span></span>
              <span className="truncate text-xs text-slate-400">{item.tindakan || '—'} · {item.pelaporNama || 'Pengguna'}</span>
            </DropdownMenu.Item>)}</div>}
          </DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu.Root>}
        {showNav && <button onClick={onRefresh} disabled={loading || busy} aria-label="Muat ulang laporan" className={`${buttonClass} border border-slate-700 bg-slate-800 px-3`}><RefreshCw aria-hidden="true" className={`h-5 w-5 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button>}
        {user && <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild><button className={`${buttonClass} border border-slate-700 bg-slate-800 pr-3`}><span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">{(user.nama || '?').trim().slice(0, 1).toUpperCase()}</span><span className="hidden text-left sm:block"><span className="block max-w-[10rem] truncate text-sm font-semibold">{user.nama}</span><span className="block text-xs text-slate-400">{user.unit}</span></span><ChevronDown aria-hidden="true" className="h-4 w-4 text-slate-400" /></button></DropdownMenu.Trigger>
          <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-[14rem] rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
            <div className="px-3 py-2"><p className="break-words text-sm font-semibold">{user.nama}</p><p className="break-words text-xs text-slate-400">{user.email}</p><div className="mt-2 flex items-center gap-2"><RoleBadge role={user.role} /><span className="text-xs text-slate-400">{user.unit}</span></div></div>
            <DropdownMenu.Separator className="my-2 h-px bg-slate-800" />
            {showNav && <DropdownMenu.Item onSelect={() => setTab('account')} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none hover:bg-slate-800 focus:bg-slate-800 ${tab === 'account' ? 'bg-slate-800' : ''}`}><UserCog aria-hidden="true" className="h-4 w-4" />Akun saya</DropdownMenu.Item>}
            <DropdownMenu.Item disabled={loggingOut || busy} onSelect={onLogout} className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-300 outline-none hover:bg-red-950/40 focus:bg-red-950/40 data-[disabled]:opacity-50"><LogOut aria-hidden="true" className="h-4 w-4" />{loggingOut ? 'Keluar…' : 'Keluar'}</DropdownMenu.Item>
          </DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu.Root>}
      </div>
    </div>
    {showNav && <nav aria-label="Halaman komplain" className="mx-auto mt-4 grid max-w-7xl grid-cols-2 gap-2 sm:flex sm:flex-wrap">{tabs.map(([value, label]) => <button key={value} ref={value === 'form' ? newButtonRef : value === 'table' ? masterButtonRef : undefined} disabled={busy || loggingOut} onClick={() => setTab(value)} aria-current={tab === value ? 'page' : undefined} className={`${buttonClass} ${tab === value ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{label}</button>)}</nav>}
  </header>;
}

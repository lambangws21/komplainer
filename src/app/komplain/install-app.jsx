'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';
const DISMISS_KEY = 'komplain-install-toast-dismissed';

export default function InstallApp({ role = 'pelapor' }) {
  const [installed, setInstalled] = useState(true);
  const [offline, setOffline] = useState(false);
  const [ios, setIos] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => { try { setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1'); } catch { setDismissed(false); } }, []);
  function dismiss() { setDismissed(true); try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* localStorage unavailable (private mode) */ } }
  const prompt = useRef(null);
  const installButton = useRef(null);
  const guideReturnFocus = useRef(null);
  const openGuide = () => { guideReturnFocus.current = document.activeElement; setShowGuide(true); };

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const syncInstalled = () => setInstalled(standalone.matches || window.navigator.standalone === true);
    const syncNetwork = () => setOffline(!navigator.onLine);
    const onPrompt = (event) => { event.preventDefault(); prompt.current = event; setCanInstall(true); };
    const onInstalled = () => { setInstalled(true); prompt.current = null; setCanInstall(false); };
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    syncInstalled();
    syncNetwork();
    standalone.addEventListener('change', syncInstalled);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', syncNetwork);
    window.addEventListener('offline', syncNetwork);
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error) => console.error('Pendaftaran service worker gagal:', error));
    }
    return () => {
      standalone.removeEventListener('change', syncInstalled);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', syncNetwork);
      window.removeEventListener('offline', syncNetwork);
    };
  }, []);

  async function install() {
    if (!prompt.current) { openGuide(); return; }
    setInstalling(true);
    setMessage('');
    const event = prompt.current;
    prompt.current = null;
    setCanInstall(false);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setMessage(choice.outcome === 'accepted' ? 'Permintaan instalasi diterima. Ikuti proses dari browser.' : 'Instalasi dibatalkan. Anda tetap dapat menggunakan aplikasi di browser.');
    } catch {
      setMessage('Prompt instalasi belum tersedia. Ikuti panduan pemasangan.');
      openGuide();
    } finally { setInstalling(false); }
  }

  return <>
    {offline && <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-200"><WifiOff aria-hidden="true" className="h-5 w-5 shrink-0" /><p>Perangkat sedang offline. Sambungkan internet untuk memuat atau menyimpan laporan. Tunggu konfirmasi berhasil sebelum menutup formulir.</p></div>}
    {!installed && !dismissed && <aside aria-label="Pasang aplikasi Komplain" className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-blue-900/60 bg-slate-900/95 p-3 shadow-xl shadow-black/30 backdrop-blur sm:bottom-5 sm:left-auto sm:right-5 sm:w-auto sm:max-w-xs sm:translate-x-0"><div className="flex items-start gap-2"><div className="rounded-xl bg-blue-500/15 p-2 text-blue-300"><Smartphone aria-hidden="true" className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">Pasang di perangkat?</p><p className="mt-0.5 text-xs leading-5 text-slate-400">Buka laporan lebih cepat dari layar utama.</p>{message && <p role="status" className="mt-1.5 text-xs text-blue-200">{message}</p>}<div className="mt-2 flex flex-wrap items-center gap-2"><button ref={installButton} disabled={installing} onClick={install} className={`${button} min-h-8 shrink-0 px-2.5 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-500`}><Download aria-hidden="true" className="h-3.5 w-3.5" />{installing ? 'Membuka…' : canInstall ? 'Instal' : 'Cara pasang'}</button>{(canInstall || installing) && <button onClick={openGuide} className={`${button} min-h-8 px-2 py-1.5 text-xs text-blue-200 hover:bg-blue-500/10`}>Panduan</button>}</div></div><button aria-label="Tutup saran instalasi" onClick={dismiss} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"><X aria-hidden="true" className="h-4 w-4" /></button></div></aside>}
    <Dialog.Root open={showGuide} onOpenChange={setShowGuide}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm" /><Dialog.Content data-role={role} onCloseAutoFocus={(event) => { const target = guideReturnFocus.current?.isConnected ? guideReturnFocus.current : installButton.current; if (target) { event.preventDefault(); target.focus(); } }} className="komplain-theme fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl sm:p-6"><Dialog.Title className="pr-12 text-xl font-bold">Pasang di perangkat</Dialog.Title><Dialog.Description className="mt-2 text-sm text-slate-400">Ikon Komplain akan tersedia di layar utama perangkat.</Dialog.Description><Dialog.Close aria-label="Tutup panduan instalasi" className={`${button} absolute right-3 top-3 px-3 text-slate-300`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close><div className="mt-5 space-y-4">
      {(ios ? ['ios', 'android'] : ['android', 'ios']).map((platform) => <section key={platform} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><h3 className="font-semibold">{platform === 'ios' ? 'iPhone / iPad' : 'Android'}</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">{(platform === 'ios' ? ['Buka alamat aplikasi ini di Safari.', 'Ketuk menu Bagikan, lalu pilih Tambahkan ke Layar Utama (Add to Home Screen).', 'Aktifkan Buka sebagai App (Open as Web App) jika pilihan ini muncul, lalu ketuk Tambah.'] : ['Buka alamat aplikasi ini di Chrome.', 'Ketuk Instal aplikasi jika tersedia, atau buka menu ⋮ lalu pilih Instal aplikasi / Tambahkan ke layar utama.', 'Ikuti konfirmasi dari browser untuk memasang.']).map((step) => <li key={step}>{step}</li>)}</ol></section>)}
      <p className="text-xs leading-5 text-slate-400">Jika dibuka dari WhatsApp atau Instagram dan menu pemasangan tidak tersedia, buka alamat yang sama di Safari atau Chrome. Internet tetap diperlukan untuk membaca dan mengirim laporan.</p><Dialog.Close className={`${button} w-full bg-slate-800`}>Mengerti</Dialog.Close>
    </div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </>;
}

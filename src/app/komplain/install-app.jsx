'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50';

export default function InstallApp({ role = 'pelapor' }) {
  const [installed, setInstalled] = useState(true);
  const [offline, setOffline] = useState(false);
  const [ios, setIos] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState('');
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
    {!installed && <aside aria-label="Pasang aplikasi Komplain" className="flex flex-col gap-4 rounded-2xl border border-blue-900/60 bg-blue-950/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-blue-500/15 p-3 text-blue-300"><Smartphone aria-hidden="true" className="h-5 w-5" /></div><div><h2 className="text-sm font-semibold text-white">Akses Komplain dari layar utama</h2><p className="mt-1 text-sm text-slate-400">Pasang di perangkat agar laporan lebih mudah dibuka.</p>{message && <p role="status" className="mt-2 text-sm text-blue-200">{message}</p>}</div></div><div className="flex shrink-0 flex-wrap items-center gap-2"><button ref={installButton} disabled={installing} onClick={install} className={`${button} shrink-0 bg-blue-600 text-white hover:bg-blue-500`}><Download aria-hidden="true" className="h-4 w-4" />{installing ? 'Membuka instalasi…' : canInstall ? 'Instal aplikasi' : 'Cara memasang'}</button>{(canInstall || installing) && <button onClick={openGuide} className={`${button} text-blue-200 hover:bg-blue-500/10`}>Panduan</button>}</div></aside>}
    <Dialog.Root open={showGuide} onOpenChange={setShowGuide}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm" /><Dialog.Content data-role={role} onCloseAutoFocus={(event) => { const target = guideReturnFocus.current?.isConnected ? guideReturnFocus.current : installButton.current; if (target) { event.preventDefault(); target.focus(); } }} className="komplain-theme fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl sm:p-6"><Dialog.Title className="pr-12 text-xl font-bold">Pasang di perangkat</Dialog.Title><Dialog.Description className="mt-2 text-sm text-slate-400">Ikon Komplain akan tersedia di layar utama perangkat.</Dialog.Description><Dialog.Close aria-label="Tutup panduan instalasi" className={`${button} absolute right-3 top-3 px-3 text-slate-300`}><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close><div className="mt-5 space-y-4">
      {(ios ? ['ios', 'android'] : ['android', 'ios']).map((platform) => <section key={platform} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><h3 className="font-semibold">{platform === 'ios' ? 'iPhone / iPad' : 'Android'}</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">{(platform === 'ios' ? ['Buka alamat aplikasi ini di Safari.', 'Ketuk menu Bagikan, lalu pilih Tambahkan ke Layar Utama (Add to Home Screen).', 'Aktifkan Buka sebagai App (Open as Web App) jika pilihan ini muncul, lalu ketuk Tambah.'] : ['Buka alamat aplikasi ini di Chrome.', 'Ketuk Instal aplikasi jika tersedia, atau buka menu ⋮ lalu pilih Instal aplikasi / Tambahkan ke layar utama.', 'Ikuti konfirmasi dari browser untuk memasang.']).map((step) => <li key={step}>{step}</li>)}</ol></section>)}
      <p className="text-xs leading-5 text-slate-400">Jika dibuka dari WhatsApp atau Instagram dan menu pemasangan tidak tersedia, buka alamat yang sama di Safari atau Chrome. Internet tetap diperlukan untuk membaca dan mengirim laporan.</p><Dialog.Close className={`${button} w-full bg-slate-800`}>Mengerti</Dialog.Close>
    </div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </>;
}

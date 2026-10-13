'use client';
import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './driver-theme.css';

// Steps reference real on-screen elements via data-tour hooks (see home-panel.jsx, navbar.jsx,
// admin-sidebar.jsx, mini-calendar.jsx) rather than text/class selectors, so the tour survives
// copy and style tweaks. Steps whose target isn't in the DOM (e.g. admin-only widgets for a
// pelapor) are filtered out before the tour starts instead of erroring mid-tour.
function stepsFor(role) {
  const shared = {
    stats: { element: '[data-tour="stats"]', popover: { title: 'Ringkasan laporan Anda', description: 'Jumlah laporan belum selesai, perlu tindakan, menunggu, dan selesai — sekilas lihat semua di sini.' } },
    createReport: { element: '[data-tour="create-report"]', popover: { title: 'Laporkan masalah baru', description: 'Klik di sini kapan saja untuk membuat laporan komplain baru.' } },
    navTabs: { element: '[data-tour="nav-tabs"]', popover: { title: 'Berpindah halaman', description: 'Gunakan tab ini untuk berpindah antara Beranda dan daftar Laporan.' } },
    notifications: { element: '[data-tour="notifications"]', popover: { title: 'Notifikasi laporan', description: 'Laporan baru yang belum Anda buka akan muncul di sini.' } },
    accountMenu: { element: '[data-tour="account-menu"]', popover: { title: 'Akun & pengaturan', description: 'Kelola profil, password, notifikasi HP, dan buka tur ini lagi kapan saja dari sini.' } },
  };
  const intro = { popover: { title: 'Selamat datang di Komplainer!', description: 'Mari kenalan singkat dengan fitur utama lewat beberapa langkah berikut.' } };
  if (role === 'admin') return [
    intro,
    { element: '[data-tour="admin-sidebar"]', popover: { title: 'Navigasi admin', description: 'Semua menu Admin ada di sini: Laporan, Pengguna, Pengumuman, Backup, dan Jadwal.' } },
    shared.stats,
    { element: '[data-tour="sla"]', popover: { title: 'Laporan terlambat', description: 'Laporan lebih dari 3 hari tanpa pembaruan otomatis muncul di sini, supaya tidak terlewat.' } },
    { element: '[data-tour="calendar"]', popover: { title: 'Kalender jadwal', description: 'Lihat sekilas jadwal & acara yang akan datang.' } },
    shared.createReport,
    shared.notifications,
    shared.accountMenu,
  ];
  return [intro, shared.stats, shared.createReport, shared.navTabs, shared.notifications, shared.accountMenu];
}

export default function FeatureTour({ open, onOpenChange, role }) {
  const driverRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const steps = stepsFor(role).filter((step) => !step.element || document.querySelector(step.element));
    if (!steps.length) { onOpenChange(false); return; }
    const driverObj = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.65,
      smoothScroll: true,
      progressText: '{{current}} dari {{total}}',
      nextBtnText: 'Berikutnya',
      prevBtnText: 'Sebelumnya',
      doneBtnText: 'Selesai',
      steps,
      onDestroyed: () => onOpenChange(false),
    });
    driverRef.current = driverObj;
    driverObj.drive();
    return () => driverObj.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return null;
}

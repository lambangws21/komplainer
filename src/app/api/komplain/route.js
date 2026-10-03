import { NextResponse } from 'next/server';

// Prefer the server-only variable; support existing deployments using the old name.
function getGoogleScriptUrl() {
  return process.env.GOOGLE_SCRIPT_URL?.trim() || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL?.trim();
}
const CONFIG_ERROR = 'URL Google Apps Script belum dikonfigurasi. Isi GOOGLE_SCRIPT_URL di environment deployment (Vercel: Settings → Environment Variables), lalu deploy ulang. Untuk lokal, isi .env.local.';

/**
 * GET Handler
 * Digunakan untuk mengambil seluruh data komplain dari Google Sheets
 */
export async function GET() {
  try {
    const GOOGLE_SCRIPT_URL = getGoogleScriptUrl();
    if (!GOOGLE_SCRIPT_URL) {
      return NextResponse.json(
        { status: 'error', message: CONFIG_ERROR },
        { status: 500 }
      );
    }

    // cache: 'no-store' memastikan data selalu ter-update langsung dari Google Sheets
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Google Script merespons dengan status HTTP ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error [GET /api/komplain]:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengambil data dari Google Sheets' },
      { status: 500 }
    );
  }
}

/**
 * POST Handler
 * Digunakan untuk aksi Create, Update, dan Delete data komplain
 */
export async function POST(request) {
  try {
    const GOOGLE_SCRIPT_URL = getGoogleScriptUrl();
    if (!GOOGLE_SCRIPT_URL) {
      return NextResponse.json(
        { status: 'error', message: CONFIG_ERROR },
        { status: 500 }
      );
    }

    // Parse payload JSON yang dikirimkan dari UI Next.js
    const body = await request.json();

    // Validasi sederhana: memastikan ada 'action' yang dikirim
    if (!body.action) {
      return NextResponse.json(
        { status: 'error', message: "Parameter 'action' (create, update, delete) wajib diisi" },
        { status: 400 }
      );
    }

    // Kirim payload ke Google Apps Script
    // Menggunakan 'Content-Type': 'text/plain;charset=utf-8' untuk menghindari CORS preflight dari Google
    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Google Script merespons dengan status HTTP ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error [POST /api/komplain]:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memproses data ke Google Sheets' },
      { status: 500 }
    );
  }
}
import { callScript, json, errorResponse, readBody, assertSameOrigin, ApiError } from '@/lib/server/apps-script';
import { hashPassword } from '@/lib/server/password.mjs';
export async function GET() {
  try { return json(await callScript('users')); } catch (error) { return errorResponse(error); }
}
export async function POST(request) {
  try {
    assertSameOrigin(request);
    const body = await readBody(request);
    if (!['createUser', 'updateUser', 'resetPassword'].includes(body.action)) throw new ApiError('Aksi akun tidak valid.');
    // Check authorization before doing password work.
    const session = await callScript('session');
    if (session.user.role !== 'admin' || session.user.mustChangePassword) throw new ApiError('Hanya admin dapat mengelola akun.', 403);
    const payload = { id: body.id, nama: body.nama, email: body.email, role: body.role, unit: body.unit, active: body.active };
    if (body.action === 'createUser' || body.action === 'resetPassword') {
      try { payload.passwordHash = await hashPassword(body.password); } catch (error) { throw new ApiError(error.message); }
    }
    return json(await callScript(body.action, payload));
  } catch (error) { return errorResponse(error); }
}

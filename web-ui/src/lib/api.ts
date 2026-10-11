import { ApiError, type User } from './types';

/**
 * Real backend login. Expected contract (agree this with the backend team):
 *   POST {API_URL}/auth/login   body: { email, password }
 *   200 -> { token: string, user: { id, name, email, role: 'student' | 'faculty' | 'admin' } }
 *   401 -> { message: string }
 * The role comes from the server (e.g. looked up from the university system), never from the client.
 */
export async function realLogin(email: string, password: string): Promise<{ user: User; token: string }> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new ApiError('AUTH_FAILED', 'NEXT_PUBLIC_API_URL is not set.');
  let res: Response;
  try {
    res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError('AUTH_FAILED', 'Cannot reach the server. Check that the backend is running.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError('AUTH_FAILED', body.message ?? 'Email or password is incorrect.');
  }
  return res.json();
}

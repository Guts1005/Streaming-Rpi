import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { NextRequest } from 'next/server';

const SECRET_KEY = process.env.JWT_SECRET || 'super-secret-key-12345';

export function signToken(payload: object) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: '1d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (e) {
    return null;
  }
}

export function setAuthCookie(token: string) {
  return serialize('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 86400, // 1 day
    path: '/',
  });
}

export function clearAuthCookie() {
  return serialize('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: -1,
    path: '/',
  });
}

export function getUserFromRequest(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { NextRequest } from 'next/server';

const isProduction = process.env.NODE_ENV === 'production';
const SECRET_KEY = process.env.JWT_SECRET || (isProduction ? '' : 'dev-jwt-secret-do-not-use-in-production');

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'super-secret-key-12345')) {
  console.warn('[SECURITY WARNING] JWT_SECRET is not configured for production; set JWT_SECRET in environment.');
}

export function signToken(payload: object) {
  if (!SECRET_KEY) {
    throw new Error('JWT_SECRET must be configured in environment');
  }
  return jwt.sign(payload, SECRET_KEY, { expiresIn: '1d' });
}

export function verifyToken(token: string) {
  if (!SECRET_KEY) return null;
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch {
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

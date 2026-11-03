import { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@jurmaq/shared/auth/config';

const authMiddleware = NextAuth({
  ...authConfig,
  pages: { ...authConfig.pages, signIn: '/login' },
}).auth;

export default async function middleware(request: NextRequest) {
  // @ts-expect-error — NextAuth middleware spread compatibility
  return authMiddleware(request);
}

// Sólo el panel: las páginas públicas no pasan por aquí y no gastan CPU.
export const config = { matcher: ['/admin', '/admin/:path*'] };

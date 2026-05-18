import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    role?: string;
    /**
     * Scope del usuario — a qué app(s) puede acceder.
     * - 'barraca' = solo admin barraca
     * - 'constructora' = solo admin constructora (default histórico)
     * - 'both' = ambos (dueño/sysadmin)
     */
    scope?: 'barraca' | 'constructora' | 'both';
  }

  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      scope?: 'barraca' | 'constructora' | 'both';
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    scope?: 'barraca' | 'constructora' | 'both';
  }
}

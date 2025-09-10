// helpers/server/auth.ts
// Auth verification helper (temporary stub)
// TODO: Replace with Clerk verification using @clerk/backend once ready.

export type AuthUser = {
  userId: string;
  email?: string;
};

export async function requireAuth(req: any): Promise<AuthUser> {
  // Development override: allow X-Dev-User-Id
  const hdrs = (req?.headers || {}) as Record<string, string>;
  const devUser = hdrs['x-dev-user-id'] || hdrs['X-Dev-User-Id'] || hdrs['x-dev-userid'];
  if (devUser && String(devUser).trim()) {
    return { userId: String(devUser).trim() };
  }
  // Production: until Clerk is wired, return 401
  const err: any = new Error('Unauthorized');
  (err.statusCode as any) = 401;
  throw err;
}

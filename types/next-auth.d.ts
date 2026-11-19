import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    // Deliberately no access token: the Session is the body of GET /api/auth/session.
    error?: string;
    emailVerified: boolean;
    admin: boolean;
    reviewer: boolean;
  }
}

declare module "next-auth/jwt" {
  // Lives only in the encrypted HttpOnly session cookie; read by server code only.
  interface JWT {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    error?: string;
    emailVerified?: boolean;
    admin?: boolean;
    reviewer?: boolean;
  }
}

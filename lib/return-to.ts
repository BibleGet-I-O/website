/**
 * The request header through which proxy.ts tells server components the page being rendered (path and
 * query), so the header's sign-in returns to it. The proxy always overwrites it, and SignInButton validates
 * it again (safeRedirect), so a client-sent value is never trusted.
 */
export const RETURN_TO_HEADER = "x-bibleget-return-to";

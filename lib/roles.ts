/** Zitadel's project-roles claim, which it sends without an :aud scope (the app lives in the project). */
export const ROLES_CLAIM = "urn:zitadel:iam:org:project:roles";

export const ADMIN_ROLE = "bibleget_admin";

/** Reviews the links from editions' verses to CBTUDR units (/review). */
export const REVIEWER_ROLE = "bibleget_reviewer";

/**
 * The claim is an object keyed by role name: {"bibleget_admin": {"<orgId>": "<domain>"}}.
 * Anything else, including a missing claim, means the role is not held.
 */
function hasRole(rolesClaim: unknown, role: string): boolean {
  if (typeof rolesClaim !== "object" || rolesClaim === null || Array.isArray(rolesClaim)) return false;
  return Object.prototype.hasOwnProperty.call(rolesClaim, role);
}

export function isAdmin(rolesClaim: unknown): boolean {
  return hasRole(rolesClaim, ADMIN_ROLE);
}

export function isReviewer(rolesClaim: unknown): boolean {
  return hasRole(rolesClaim, REVIEWER_ROLE);
}

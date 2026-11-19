/** Zitadel's project-roles claim, which it sends without an :aud scope (the app lives in the project). */
export const ROLES_CLAIM = "urn:zitadel:iam:org:project:roles";

export const ADMIN_ROLE = "bibleget_admin";

/**
 * The claim is an object keyed by role name: {"bibleget_admin": {"<orgId>": "<domain>"}}.
 * Anything else, including a missing claim, means "not an admin".
 */
export function isAdmin(rolesClaim: unknown): boolean {
  if (typeof rolesClaim !== "object" || rolesClaim === null || Array.isArray(rolesClaim)) return false;
  return Object.prototype.hasOwnProperty.call(rolesClaim, ADMIN_ROLE);
}

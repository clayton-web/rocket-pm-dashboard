/**
 * App-relative redirect targets for staff auth middleware.
 * Next.js applies `basePath` once when handling `NextResponse.redirect` — do not prefix here.
 */
export function unauthenticatedStaffRedirect(strippedPathname: string) {
  return {
    pathname: "/login",
    callbackUrl: strippedPathname,
  };
}

export function authenticatedStaffLoginRedirect() {
  return { pathname: "/inbox" };
}

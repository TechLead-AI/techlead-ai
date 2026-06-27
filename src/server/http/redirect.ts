import { NextResponse } from "next/server";

/**
 * Redirect to a same-origin path without trusting the request's host.
 *
 * Behind a proxy (e.g. Railway), `req.url` reports the internal address the app
 * actually listens on (`http://localhost:8080`), so building an absolute URL
 * from it sends the browser to the wrong place. A relative `Location` header
 * sidesteps this: the browser resolves it against the address it requested —
 * the public domain — so it works the same locally and behind any proxy.
 *
 * Status 303 ("See Other") makes the browser follow the redirect with a GET,
 * which is what we want after handling a form POST.
 */
export function relativeRedirect(path: string, status = 303): NextResponse {
  return new NextResponse(null, { status, headers: { Location: path } });
}

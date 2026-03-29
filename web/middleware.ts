import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LANGS, DEFAULT_LANG, type Lang } from "./lib/i18n";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const lang = LANGS.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );

  if (lang) {
    const response = NextResponse.next();
    response.headers.set("x-lang", lang);
    return response;
  }

  if (pathname === "/") {
    const acceptLang = request.headers.get("accept-language") ?? "";
    const preferred = acceptLang.split(",")[0].trim().slice(0, 2).toLowerCase();
    const detected = (LANGS.includes(preferred as Lang) ? preferred : DEFAULT_LANG) as Lang;
    return NextResponse.redirect(new URL(`/${detected}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|public).*)"],
};

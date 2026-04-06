import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LANGS, DEFAULT_LANG, type Lang } from "./lib/i18n";

export function proxy(request: NextRequest) {
  const acceptLang = request.headers.get("accept-language") ?? "";
  const preferred = acceptLang.split(",")[0].trim().slice(0, 2).toLowerCase();
  const lang = (LANGS.includes(preferred as Lang) ? preferred : DEFAULT_LANG) as Lang;

  const response = NextResponse.next();
  response.headers.set("x-lang", lang);
  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|public).*)"],
};

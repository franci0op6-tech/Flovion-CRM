import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // req.auth esiste solo se l'utente ha fatto il login con successo
  const isLogged = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  // Se NON è loggato e sta cercando di entrare nella dashboard -> caccialo su /login
  if (!isLogged && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Se È loggato ma prova ad andare sulla pagina di login -> rimandalo alla dashboard
  if (isLogged && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  
  return NextResponse.next();
});

export const config = {
  // Applica il blocco a tutto, tranne file di sistema e immagini
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
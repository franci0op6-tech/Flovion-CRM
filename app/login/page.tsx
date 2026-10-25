"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import iconFolavion from "../icon.png"; // <--- Importiamo la nuova icona

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errore, setErrore] = useState("");
  const router = useRouter();

  async function gestisciLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); 
    setErrore("");
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const risultato = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (risultato?.error) {
      setErrore("Email o password errati. Riprova.");
      setIsLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-8 sm:p-10 shadow-xl border border-gray-100">
        
        {/* LOGO E SLOGAN AZIENDALE */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-0.5 mb-2">
            <div className="relative h-12 w-12 flex-shrink-0">
              <Image 
                src={iconFolavion} 
                alt="Folavion Icon" 
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-3xl font-extrabold tracking-wider text-slate-900 font-sans">
              OLAVION
            </span>
          </div>
          <p className="text-xs font-medium tracking-widest text-slate-400 uppercase">
            SMARTER BUSINESS. TOGETHER.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={gestisciLogin}>
          {errore && (
            <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700 border border-red-200">
              {errore}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="block w-full appearance-none rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 sm:text-sm transition-colors"
                placeholder="mario@esempio.it"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="block w-full appearance-none rounded-xl border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 sm:text-sm transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-slate-900 py-3 px-4 text-sm font-semibold text-white shadow-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-all disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Accesso in corso...</span>
              </>
            ) : (
              "Entra"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
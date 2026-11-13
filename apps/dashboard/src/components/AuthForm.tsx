"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

type Field = { name: string; label: string; type?: string; autoComplete?: string };

export function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Evita que el formulario se envíe antes de que cargue JavaScript (la clave acabaría en la URL).
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const fields: Field[] =
    mode === "signup"
      ? [
          { name: "name", label: "Tu nombre", autoComplete: "name" },
          { name: "organizationName", label: "Nombre de tu empresa o tienda", autoComplete: "organization" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Contraseña (mínimo 12 caracteres)", type: "password", autoComplete: "new-password" },
        ]
      : [
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Contraseña", type: "password", autoComplete: "current-password" },
        ];

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/auth/${mode}`, { method: "POST", body: JSON.stringify(data) });
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="mb-6 text-2xl font-bold">{mode === "signup" ? "Crea tu cuenta" : "Inicia sesión"}</h1>
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
        {fields.map((f) => (
          <label key={f.name} className="flex flex-col gap-1 text-sm font-medium">
            {f.label}
            <input name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-indigo-500" />
          </label>
        ))}
        {mode === "signup" && (
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input name="acceptTerms" type="checkbox" required className="mt-0.5" />
            <span>
              Acepto los <Link className="text-indigo-600" href="/terminos" target="_blank">Términos y el acuerdo de tratamiento de datos</Link> y
              la <Link className="text-indigo-600" href="/privacidad" target="_blank">Política de privacidad</Link>.
            </span>
          </label>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button disabled={!ready || loading} className="rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {loading ? "Un momento…" : mode === "signup" ? "Crear cuenta" : "Entrar"}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-600">
        {mode === "signup" ? <>¿Ya tienes cuenta? <Link className="text-indigo-600" href="/login">Inicia sesión</Link></>
          : <>¿No tienes cuenta? <Link className="text-indigo-600" href="/signup">Créala aquí</Link></>}
      </p>
    </main>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">VISIONLIGHT</h1>
      <p className="text-lg text-slate-600">Recupera las ventas que tu tienda Shopify está perdiendo.</p>
      <div className="flex gap-3">
        <Link href="/signup" className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700">Crear cuenta</Link>
        <Link href="/login" className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium hover:bg-white">Iniciar sesión</Link>
      </div>
    </main>
  );
}

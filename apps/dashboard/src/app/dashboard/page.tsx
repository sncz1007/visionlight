"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Me } from "@/lib/api";

type Member = { id: string; role: string; user: { email: string; name: string | null } };

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    api<Me>("/auth/me")
      .then(async (data) => {
        setMe(data);
        const org = data.organizations[0];
        if (org) setMembers((await api<{ members: Member[] }>(`/orgs/${org.id}/members`)).members);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!me) return <p className="p-8 text-slate-500">Cargando…</p>;
  const org = me.organizations[0];

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <span className="font-bold">VISIONLIGHT</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">{me.user.email}</span>
          <button onClick={logout} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">Salir</button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold">{org?.name}</h1>
        <p className="text-sm text-slate-500">Tu rol: {org?.role}</p>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {["Visitantes", "Carritos abandonados", "Ingresos recuperados"].map((label) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">—</p>
              <p className="mt-1 text-xs text-slate-400">Conecta tu tienda Shopify (próximamente)</p>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Equipo</h2>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between px-5 py-3 text-sm">
                <span>{m.user.name ?? m.user.email} <span className="text-slate-400">· {m.user.email}</span></span>
                <span className="text-slate-500">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

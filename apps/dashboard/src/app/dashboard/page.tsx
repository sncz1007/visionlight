"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, type Me } from "@/lib/api";

type Member = { id: string; role: string; user: { email: string; name: string | null } };
type Store = {
  id: string; shopDomain: string; name: string | null; status: "ACTIVE" | "UNINSTALLED"; pixelActive: boolean;
  recoveryEnabled: boolean; recoveryDelayMinutes: number;
};
const DELAYS = [
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 180, label: "3 horas" },
  { value: 1440, label: "24 horas" },
];
type Activity = {
  last7Days: { visitors: number; productViews: number; addToCarts: number; orders: number; revenue: string };
  recovery: { emailsSent: number; recoveredCarts: number; recoveredRevenue: string };
  openCarts: number;
  recentEvents: { id: string; name: string; url: string | null; occurredAt: string; shop: string }[];
};

type CartRow = {
  id: string; shop: string; status: "OPEN" | "ABANDONED"; email: string | null; phone: string | null; name: string | null;
  marketingConsent: boolean; totalPrice: string; currency: string; recoveryUrl: string | null; updatedAt: string;
  lineItems: { title: string; quantity: number; price: string }[];
  recoveryEmail: { status: "SENT" | "DRY_RUN" | "SKIPPED" | "FAILED"; sentAt: string; error: string | null } | null;
};

function emailBadge(e: CartRow["recoveryEmail"]) {
  if (!e) return null;
  const when = new Date(e.sentAt).toLocaleString("es");
  if (e.status === "SENT") return { cls: "bg-indigo-50 text-indigo-700", text: `Email enviado · ${when}` };
  if (e.status === "DRY_RUN") return { cls: "bg-indigo-50 text-indigo-700", text: `Email de prueba (sin enviar) · ${when}` };
  if (e.status === "FAILED") return { cls: "bg-red-50 text-red-700", text: "El email falló" };
  return { cls: "bg-slate-100 text-slate-500", text: `Sin email: ${e.error ?? "omitido"}` };
}

const EVENT_LABELS: Record<string, string> = {
  page_viewed: "Vio una página",
  product_viewed: "Vio un producto",
  collection_viewed: "Vio una colección",
  search_submitted: "Buscó",
  product_added_to_cart: "Añadió al carrito",
  product_removed_from_cart: "Quitó del carrito",
  cart_viewed: "Vio el carrito",
  checkout_started: "Inició el pago",
  checkout_contact_info_submitted: "Dejó sus datos de contacto",
  checkout_completed: "Completó la compra",
};

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [carts, setCarts] = useState<CartRow[]>([]);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const org = me?.organizations[0];
  const canManage = org?.role === "OWNER" || org?.role === "ADMIN";

  const load = useCallback(async (orgId: string) => {
    const [m, s, a, c] = await Promise.all([
      api<{ members: Member[] }>(`/orgs/${orgId}/members`),
      api<{ stores: Store[] }>(`/orgs/${orgId}/stores`),
      api<Activity>(`/orgs/${orgId}/activity`),
      api<{ carts: CartRow[] }>(`/orgs/${orgId}/carts`),
    ]);
    setCarts(c.carts);
    setMembers(m.members);
    setStores(s.stores);
    setActivity(a);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("shopify");
    if (result === "connected") setNotice({ kind: "ok", text: "¡Tienda conectada! La actividad aparecerá en cuanto haya visitas." });
    if (result === "error") setNotice({ kind: "error", text: "No se pudo conectar la tienda. Inténtalo de nuevo." });
    if (result) window.history.replaceState(null, "", "/dashboard");

    api<Me>("/auth/me")
      .then(async (data) => {
        setMe(data);
        const first = data.organizations[0];
        if (first) await load(first.id);
      })
      .catch(() => router.replace("/login"));
  }, [router, load]);

  async function connect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!org) return;
    setConnecting(true);
    setNotice(null);
    const shop = String(new FormData(e.currentTarget).get("shop") ?? "");
    try {
      const { url } = await api<{ url: string }>(`/orgs/${org.id}/shopify/install`, {
        method: "POST",
        body: JSON.stringify({ shop }),
      });
      window.location.href = url;
    } catch (err) {
      setNotice({ kind: "error", text: (err as Error).message });
      setConnecting(false);
    }
  }

  async function saveRecovery(store: Store, patch: Partial<Pick<Store, "recoveryEnabled" | "recoveryDelayMinutes">>) {
    if (!org) return;
    const next = { ...store, ...patch };
    setStores((list) => list.map((s) => (s.id === store.id ? next : s)));
    try {
      await api(`/orgs/${org.id}/stores/${store.id}/recovery`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: next.recoveryEnabled, delayMinutes: next.recoveryDelayMinutes }),
      });
    } catch (err) {
      setStores((list) => list.map((s) => (s.id === store.id ? store : s)));
      setNotice({ kind: "error", text: (err as Error).message });
    }
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!me) return <p className="p-8 text-slate-500">Cargando…</p>;
  const hasStore = stores.some((s) => s.status === "ACTIVE");
  const stats = activity?.last7Days;
  const money = (v?: string) => Number(v ?? 0).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const revenue = money(stats?.revenue);
  const cards = [
    { label: "Visitantes (7 días)", value: stats?.visitors ?? 0 },
    { label: "Productos vistos", value: stats?.productViews ?? 0 },
    { label: "Añadidos al carrito", value: stats?.addToCarts ?? 0 },
    { label: "Carritos abiertos", value: activity?.openCarts ?? 0 },
    { label: "Pedidos (7 días)", value: stats?.orders ?? 0 },
    { label: "Ventas (7 días)", value: `$${revenue}` },
    { label: "Emails de recuperación (7 días)", value: activity?.recovery.emailsSent ?? 0 },
    { label: "Ventas recuperadas (7 días)", value: `$${money(activity?.recovery.recoveredRevenue)}` },
  ];

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <span className="font-bold">VISIONLIGHT</span>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-slate-600 sm:inline">{me.user.email}</span>
          <button onClick={logout} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
            Salir
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold">{org?.name}</h1>
        <p className="text-sm text-slate-500">Tu rol: {org?.role}</p>

        {notice && (
          <p
            className={`mt-6 rounded-lg px-4 py-3 text-sm ${
              notice.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
            }`}
          >
            {notice.text}
          </p>
        )}

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Tiendas</h2>
          {stores.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100">
              {stores.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span>
                    <span className="font-medium">{s.name ?? s.shopDomain}</span>{" "}
                    <span className="text-slate-400">· {s.shopDomain}</span>
                  </span>
                  <span className="flex gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        s.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.status === "ACTIVE" ? "Conectada" : "Desconectada"}
                    </span>
                    {s.status === "ACTIVE" && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          s.pixelActive ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {s.pixelActive ? "Pixel activo" : "Pixel pendiente"}
                      </span>
                    )}
                  </span>
                  {s.status === "ACTIVE" && (
                    <div className="flex w-full flex-wrap items-center gap-3 text-slate-600">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={s.recoveryEnabled}
                          disabled={!canManage}
                          onChange={(e) => saveRecovery(s, { recoveryEnabled: e.target.checked })}
                        />
                        Enviar emails de recuperación
                      </label>
                      <label className="flex items-center gap-2">
                        después de
                        <select
                          value={s.recoveryDelayMinutes}
                          disabled={!canManage || !s.recoveryEnabled}
                          onChange={(e) => saveRecovery(s, { recoveryDelayMinutes: Number(e.target.value) })}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1"
                        >
                          {DELAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                        sin comprar
                      </label>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <form onSubmit={connect} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                name="shop"
                required
                placeholder="mitienda.myshopify.com"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <button
                disabled={connecting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {connecting ? "Abriendo Shopify…" : hasStore ? "Conectar otra tienda" : "Conectar tienda Shopify"}
              </button>
            </form>
          )}
        </section>

        <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">{c.label}</p>
              <p className="mt-2 text-2xl font-semibold">{c.value}</p>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Carritos sin comprar</h2>
          {carts.length ? (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {carts.map((c) => (
                <li key={c.id} className="px-5 py-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      {c.name && <p className="font-medium">{c.name}</p>}
                      <p className={c.name ? "text-slate-600" : "font-medium"}>{c.email ?? "Sin correo todavía"}</p>
                      {c.phone && <p className="text-slate-500">{c.phone}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {Number(c.totalPrice).toLocaleString("es", { minimumFractionDigits: 2 })} {c.currency}
                      </p>
                      <p className="text-slate-500">{new Date(c.updatedAt).toLocaleString("es")}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-slate-600">
                    {c.lineItems.map((i) => `${i.quantity} × ${i.title}`).join(", ") || "Sin productos"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${c.marketingConsent ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {c.marketingConsent ? "Acepta recibir ofertas" : "No acepta ofertas"}
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                      {c.status === "ABANDONED" ? "Abandonado" : "Abierto"}
                    </span>
                    {emailBadge(c.recoveryEmail) && (
                      <span className={`rounded-full px-2 py-0.5 ${emailBadge(c.recoveryEmail)!.cls}`}>{emailBadge(c.recoveryEmail)!.text}</span>
                    )}
                    {c.recoveryUrl && (
                      <a href={c.recoveryUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                        Enlace de recuperación
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-500">
              No hay carritos sin comprar por ahora.
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Actividad reciente</h2>
          {activity?.recentEvents.length ? (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {activity.recentEvents.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    {EVENT_LABELS[e.name] ?? e.name} <span className="text-slate-400">· {e.shop}</span>
                  </span>
                  <span className="text-slate-500">{new Date(e.occurredAt).toLocaleString("es")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-6 text-sm text-slate-500">
              {hasStore
                ? "Aún no hay visitas registradas. Abre tu tienda en otra pestaña para probar."
                : "Conecta tu tienda para empezar a ver la actividad."}
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Equipo</h2>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between px-5 py-3 text-sm">
                <span>
                  {m.user.name ?? m.user.email} <span className="text-slate-400">· {m.user.email}</span>
                </span>
                <span className="text-slate-500">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const isProd = process.env.NODE_ENV === "production";

export const config = {
  isProd,
  port: Number(process.env.API_PORT ?? 4000),
  sessionSecret: required("SESSION_SECRET", isProd ? undefined : "dev-only-secret-change-me"),
  dashboardUrl: process.env.DASHBOARD_URL ?? "http://localhost:3000",
  sessionDays: 30,
  cookieName: "vl_session",
};

if (isProd && config.sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET debe tener al menos 32 caracteres en producción");
}

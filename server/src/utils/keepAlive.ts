/**
 * keepAlive.ts
 * Pings Render services every 14 minutes to prevent free tier spin-down.
 * Add RENDER_SERVER_URL and RENDER_ENGINE_URL to your environment variables.
 */

const PING_INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

const services = [
  { name: "Server",           url: process.env.RENDER_SERVER_URL },
  { name: "Execution Engine", url: process.env.RENDER_ENGINE_URL },
];

const ping = async (name: string, url: string) => {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10000) });
    console.log(`[KeepAlive] ✅ ${name} — ${res.status}`);
  } catch (err: any) {
    console.warn(`[KeepAlive] ⚠️  ${name} ping failed — ${err.message}`);
  }
};

export const startKeepAlive = () => {
  const activeServices = services.filter((s) => s.url);

  if (activeServices.length === 0) {
    console.log("[KeepAlive] No RENDER_SERVER_URL or RENDER_ENGINE_URL set — skipping.");
    return;
  }

  console.log(`[KeepAlive] Starting — pinging ${activeServices.length} service(s) every 14 min`);
  activeServices.forEach((s) => console.log(`[KeepAlive]   → ${s.name}: ${s.url}/health`));

  // Ping immediately on startup
  activeServices.forEach((s) => ping(s.name, s.url!));

  // Then ping every 14 minutes
  setInterval(() => {
    activeServices.forEach((s) => ping(s.name, s.url!));
  }, PING_INTERVAL_MS);
};

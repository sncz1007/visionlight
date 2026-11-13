import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

// Procesador de tareas en segundo plano. En la fase 3 aquí vivirán
// la detección de carritos abandonados y el envío de emails de recuperación.
const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });

export const QUEUES = { maintenance: "maintenance" } as const;

const maintenance = new Queue(QUEUES.maintenance, { connection });

const worker = new Worker(
  QUEUES.maintenance,
  async (job) => {
    if (job.name === "cleanup-sessions") {
      const { prisma } = await import("@visionlight/database");
      const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      return { deletedSessions: count };
    }
    if (job.name === "retention") {
      const { prisma, applyRetention } = await import("@visionlight/database");
      return applyRetention(prisma);
    }
  },
  { connection },
);

worker.on("completed", (job, result) => console.log(`[worker] ${job.name} ok`, result));
worker.on("failed", (job, err) => console.error(`[worker] ${job?.name} falló`, err));

// Borra sesiones vencidas cada hora.
await maintenance.upsertJobScheduler("cleanup-sessions-hourly", { every: 60 * 60 * 1000 }, { name: "cleanup-sessions" });
// Borra cada día los datos que superaron su plazo de retención.
await maintenance.upsertJobScheduler("retention-daily", { pattern: "0 3 * * *" }, { name: "retention" });
console.log("[worker] listo");

async function shutdown() {
  await worker.close();
  await maintenance.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

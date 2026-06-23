import PgBoss from "pg-boss";
import { REVIEW_QUEUE, handleReviewJob, type ReviewJobData } from "./jobs";

/**
 * pg-boss queue running on the existing Postgres (no Redis). The web app
 * enqueues review jobs; the worker process (src/worker) consumes them. Both use
 * the same DATABASE_URL.
 */
let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  boss = new PgBoss({ connectionString });
  await boss.start();
  await boss.createQueue(REVIEW_QUEUE);
  return boss;
}

/** Enqueue a review (called by the webhook). */
export async function enqueueReview(data: ReviewJobData): Promise<void> {
  const b = await getBoss();
  await b.send(REVIEW_QUEUE, data);
}

/** Register the worker handler (called by the worker process). */
export async function registerReviewWorker(): Promise<void> {
  const b = await getBoss();
  await b.work<ReviewJobData>(REVIEW_QUEUE, async ([job]) => {
    await handleReviewJob(job.data);
  });
}

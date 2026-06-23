import "dotenv/config";
import { registerReviewWorker } from "@/server/queue/queue";

/**
 * The review worker process. Run with `npm run worker`. Consumes review jobs
 * from pg-boss so a burst of PRs never blocks the web server.
 */
async function main() {
  await registerReviewWorker();
  console.log("Review worker started. Waiting for jobs...");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});

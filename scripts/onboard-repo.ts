import "dotenv/config";
import { prisma } from "../src/server/db/client";
import { prismaStore } from "../src/server/onboarding/store";
import { onboardRepo } from "../src/server/onboarding/onboard";

/**
 * Register a real GitHub repo and its mentored juniors so the live webhook will
 * review their PRs. Idempotent — safe to re-run. See CONNECT_GITHUB.md.
 *
 * Usage:
 *   npm run onboard -- --org "Colman" --repo "owner/name" --juniors "alice,bob"
 *
 * Flags can also be supplied via env: ONBOARD_ORG, ONBOARD_REPO, ONBOARD_JUNIORS.
 */

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const orgName = flag("org") ?? process.env.ONBOARD_ORG;
  const repoFullName = flag("repo") ?? process.env.ONBOARD_REPO;
  const juniorLogins = flag("juniors") ?? process.env.ONBOARD_JUNIORS;

  if (!orgName || !repoFullName || !juniorLogins) {
    console.error(
      'Usage: npm run onboard -- --org "Colman" --repo "owner/name" --juniors "alice,bob"',
    );
    process.exit(1);
  }

  const result = await onboardRepo(prismaStore, { orgName, repoFullName, juniorLogins });

  console.log(`Org:  ${result.org.name} (${result.org.id})`);
  console.log(`Repo: ${result.repo.fullName} ${result.repo.created ? "(created)" : "(already registered)"}`);
  for (const j of result.juniors) {
    const state = j.created ? "created" : j.promoted ? "promoted to mentored junior" : "already a mentored junior";
    console.log(`  - ${j.login} (${state})`);
  }
  console.log("\nDone. Open or push to a PR authored by one of these juniors to trigger a review.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

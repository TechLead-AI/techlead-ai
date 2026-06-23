import "dotenv/config";
import { App } from "octokit";

/**
 * Verify the GitHub App credentials in .env actually authenticate, and list
 * where the App is installed. Run after filling in GITHUB_APP_ID and
 * GITHUB_APP_PRIVATE_KEY (see CONNECT_GITHUB.md). Read-only — makes no changes.
 *
 *   npm run check:github
 */
async function main() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) {
    console.error("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set in .env");
    process.exit(1);
  }

  const app = new App({ appId, privateKey: privateKey.replace(/\\n/g, "\n") });

  // GET /app uses the App's JWT — proves the App ID + private key match.
  const { data: me } = await app.octokit.request("GET /app");
  console.log(`Authenticated as App: ${me.name} (slug: ${me.slug}, id: ${me.id})`);

  // List installations — proves the App is installed on at least one account.
  const installs = await app.octokit.request("GET /app/installations");
  if (installs.data.length === 0) {
    console.log("\nNot installed anywhere yet. Click 'Install App' on the App's page.");
    return;
  }
  for (const inst of installs.data) {
    const account = (inst.account && ("login" in inst.account ? inst.account.login : inst.account.slug)) ?? "?";
    console.log(`\nInstalled on: ${account} (installation ${inst.id})`);
    const octokit = await app.getInstallationOctokit(inst.id);
    const { data: repos } = await octokit.request("GET /installation/repositories");
    if (repos.repositories.length === 0) {
      console.log("  (no repositories selected)");
    }
    for (const r of repos.repositories) {
      console.log(`  - ${r.full_name}`);
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

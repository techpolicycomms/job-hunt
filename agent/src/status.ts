/**
 * Check the status of the agent setup and list recent sessions.
 * Usage: npm run status
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "fs";

const client = new Anthropic();

const configPath = new URL("../agent-config.json", import.meta.url);

async function main() {
  if (!existsSync(configPath)) {
    console.log("No agent-config.json found. Run 'npm run setup' first.");
    process.exit(0);
  }

  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  console.log("JobPilot Managed Agent");
  console.log("─".repeat(40));
  console.log(`Agent ID:       ${config.agent_id}`);
  console.log(`Environment ID: ${config.environment_id}`);
  console.log(`Created:        ${config.created_at}`);
  console.log("");

  // Try to get agent details
  try {
    const agent = await client.beta.agents.retrieve(config.agent_id);
    console.log(`Agent Name:     ${agent.name}`);
    console.log(`Model:          ${(agent.model as any)?.id ?? agent.model}`);
    console.log(`Version:        ${agent.version}`);
  } catch (err) {
    console.log("Could not retrieve agent details (may need to re-run setup).");
  }

  // List recent sessions
  try {
    const sessions = await client.beta.sessions.list({ limit: 10 });
    const sessionList = sessions.data ?? [];
    if (sessionList.length > 0) {
      console.log(`\nRecent Sessions (${sessionList.length}):`);
      console.log("─".repeat(40));
      for (const s of sessionList) {
        console.log(`  ${s.id}  ${(s as any).title ?? "Untitled"}  [${(s as any).status ?? "unknown"}]`);
      }
    } else {
      console.log("\nNo sessions yet. Run 'npm run generate -- <job-url>' to create one.");
    }
  } catch {
    // Sessions list might not be available
  }
}

main().catch(console.error);

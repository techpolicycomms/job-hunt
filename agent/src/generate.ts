/**
 * Generate CV and Cover Letter for a job posting.
 *
 * Usage:
 *   npm run generate -- https://linkedin.com/jobs/view/12345
 *   npm run generate -- "paste the job description text here"
 *
 * The agent will:
 * 1. Fetch/analyze the job posting
 * 2. Select the best lens for each career stint
 * 3. Generate ATS-optimized CV and cover letter
 * 4. Save them as text files in the container
 * 5. Print the results
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "fs";

const client = new Anthropic();

// Load config
const configPath = new URL("../agent-config.json", import.meta.url);
if (!existsSync(configPath)) {
  console.error("Error: agent-config.json not found. Run 'npm run setup' first.");
  process.exit(1);
}

const config = JSON.parse(readFileSync(configPath, "utf-8"));

async function main() {
  const input = process.argv.slice(2).join(" ").trim();
  if (!input) {
    console.error("Usage: npm run generate -- <job-url-or-description>");
    console.error("");
    console.error("Examples:");
    console.error('  npm run generate -- https://linkedin.com/jobs/view/12345');
    console.error('  npm run generate -- "Programme Manager at UNICEF in Geneva..."');
    process.exit(1);
  }

  const isUrl = input.startsWith("http://") || input.startsWith("https://");
  const userMessage = isUrl
    ? `Generate a tailored CV and cover letter for this job posting: ${input}

Please:
1. Fetch and analyze the job posting at that URL
2. Extract key requirements and ATS keywords
3. Select the best lens for each of my 4 career stints
4. Generate the ATS-optimized CV
5. Generate the tailored cover letter
6. Save both files with the proper naming convention
7. Show me the contents of both documents`
    : `Generate a tailored CV and cover letter for this job:

${input}

Please:
1. Analyze the job description above
2. Extract key requirements and ATS keywords
3. Select the best lens for each of my 4 career stints
4. Generate the ATS-optimized CV
5. Generate the tailored cover letter
6. Save both files with the proper naming convention
7. Show me the contents of both documents`;

  console.log("Starting JobPilot session...\n");

  // Create session
  const session = await client.beta.sessions.create({
    agent: config.agent_id,
    environment_id: config.environment_id,
    title: `Job Application — ${isUrl ? input.slice(0, 60) : input.slice(0, 60)}`,
  });

  console.log(`Session: ${session.id}\n`);
  console.log("─".repeat(70));

  // Open stream and send message
  const stream = await client.beta.sessions.events.stream(session.id);

  await client.beta.sessions.events.send(session.id, {
    events: [
      {
        type: "user.message",
        content: [{ type: "text", text: userMessage }],
      },
    ],
  });

  // Process streaming events
  for await (const event of stream) {
    if (event.type === "agent.message") {
      for (const block of (event as any).content ?? []) {
        if (block.type === "text") {
          process.stdout.write(block.text);
        }
      }
    } else if (event.type === "agent.tool_use") {
      const toolEvent = event as any;
      const name = toolEvent.name ?? "unknown";
      if (name === "write") {
        console.log(`\n[Writing file: ${toolEvent.input?.file_path ?? ""}]`);
      } else if (name === "bash") {
        // Suppress noisy bash output
      } else if (name === "web_search") {
        console.log(`\n[Searching web...]`);
      } else {
        console.log(`\n[Using tool: ${name}]`);
      }
    } else if (event.type === "session.status_idle") {
      console.log("\n\n" + "─".repeat(70));
      console.log("Agent finished.");
      break;
    }
  }

  // Print session info for reference
  console.log(`\nSession ID: ${session.id}`);
  console.log("You can continue this session or retrieve files from the container.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

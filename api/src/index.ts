import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { loadConfig } from "@innsight/config";
import { createAIConsultant } from "./ai/consultant.js";
import { createDiscussionService } from "./ai/discussionService.js";
import { createGeminiClient } from "./ai/gemini.js";
import { TOOLS } from "./ai/tools/index.js";
import { createApp } from "./app.js";
import { connectMongo } from "./db/mongo.js";
import { loadEnv } from "./env.js";
import { createLogger } from "./logger.js";
import { createMLClient } from "./ml/mlClient.js";
import { createSimulationEngine } from "./simulation/index.js";
import { createStay22Client } from "./stay22/client.js";

// Single source of env truth: the repo-root .env (no per-package .env files).
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
dotenv.config({ path: path.join(repoRoot, ".env") });

async function main(): Promise<void> {
  const logger = createLogger(process.env.LOG_LEVEL);
  const env = loadEnv(logger);
  const config = loadConfig(logger);

  const mongo = await connectMongo(env, logger);
  const stay22 = createStay22Client(env, logger);
  const mlClient = createMLClient(env.ML_SERVICE_URL, logger);
  const simulation = createSimulationEngine(config, logger, mlClient);
  const gemini = createGeminiClient(env, logger);
  const ai = createAIConsultant(gemini, TOOLS, {
    engine: simulation,
    mongo,
    stay22,
  });
  const discussion = createDiscussionService(env, logger);

  const app = createApp({
    env,
    logger,
    mongo,
    stay22,
    simulation,
    ai,
    discussion,
    mlClient,
  });
  const port = env.PORT ?? 4000;
  app.listen(port, () => {
    logger.info({ port }, "innsight api listening");
  });
}

main().catch((err) => {
  // Last-resort: startup must not die silently.
  console.error("fatal startup error", err);
  process.exit(1);
});

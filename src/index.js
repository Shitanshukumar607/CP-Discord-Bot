/**
 * CP Verification Bot - Main Entry Point
 *
 * This Discord bot verifies ownership of Codeforces and CodeChef accounts
 * by asking users to submit a Compilation Error to a random problem.
 *
 * Features:
 * - Link multiple CP accounts per user
 * - Codeforces rank-based role assignment
 * - Supabase database for persistent storage
 * - 10-minute verification window
 */

import {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
} from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cleanupExpiredVerifications } from "./services/supabase.client.js";

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "DISCORD_TOKEN",
  "CLIENT_ID",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// ES Module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Discord client with required intents
// Note: GuildMembers is a privileged intent - only add if enabled in Discord Developer Portal
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Collection to store commands
client.commands = new Collection();

/**
 * Load all command files from the commands directory
 */
async function loadCommands() {
  const commandsPath = path.join(__dirname, "commands");

  // Ensure commands directory exists
  if (!fs.existsSync(commandsPath)) {
    console.error("❌ Commands directory not found:", commandsPath);
    return;
  }

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    try {
      const command = await import(`file://${filePath}`);

      // Validate command structure
      if ("data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
        console.log(`✅ Loaded command: ${command.data.name}`);
      } else {
        console.warn(
          `⚠️ Command at ${file} is missing required "data" or "execute" property`
        );
      }
    } catch (error) {
      console.error(`❌ Error loading command ${file}:`, error);
    }
  }
}

/**
 * Handle slash command interactions
 */
async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);

    const errorMessage = {
      content: "❌ There was an error while executing this command!",
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
}

/**
 * Cleanup expired verifications periodically
 */
function startCleanupJob() {
  // Run cleanup every 5 minutes
  const CLEANUP_INTERVAL = 5 * 60 * 1000;

  setInterval(async () => {
    try {
      const deletedCount = await cleanupExpiredVerifications();
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} expired verification(s)`);
      }
    } catch (error) {
      console.error("Error during verification cleanup:", error);
    }
  }, CLEANUP_INTERVAL);

  console.log("⏰ Verification cleanup job started (every 5 minutes)");
}

// =====================================================
// Event Handlers
// =====================================================

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log("═".repeat(50));
  console.log(`🤖 Bot is online!`);
  console.log(`📛 Logged in as: ${readyClient.user.tag}`);
  console.log(`🆔 Client ID: ${readyClient.user.id}`);
  console.log(`🌐 Serving ${readyClient.guilds.cache.size} guild(s)`);
  console.log("═".repeat(50));

  // Start cleanup job
  startCleanupJob();
});

// Interaction handler
client.on(Events.InteractionCreate, handleInteraction);

// Error handling
client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down gracefully...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down...");
  client.destroy();
  process.exit(0);
});

// Handle unhandled rejections
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

// =====================================================
// Start the bot
// =====================================================

async function main() {
  console.log("🚀 Starting CP Verification Bot...\n");

  try {
    // Load commands
    await loadCommands();
    console.log(`\n📦 Loaded ${client.commands.size} command(s)\n`);

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    process.exit(1);
  }
}

main();

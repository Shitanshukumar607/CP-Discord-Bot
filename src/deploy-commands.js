/**
 * Deploy Commands Script
 *
 * This script registers all slash commands with Discord.
 * Run this once when you add/update commands, or when setting up the bot.
 *
 * Usage:
 *   npm run deploy
 *   node src/deploy-commands.js
 *   node src/deploy-commands.js --guild <GUILD_ID>  (for faster testing)
 */

import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

// ES Module dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate required environment variables
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error("❌ Missing DISCORD_TOKEN or CLIENT_ID in .env file");
  process.exit(1);
}

// Parse command line arguments for guild-specific deployment
const args = process.argv.slice(2);
const guildIndex = args.indexOf("--guild");
const guildId = guildIndex !== -1 ? args[guildIndex + 1] : null;

/**
 * Load all commands and return their JSON data
 */
async function loadCommandsData() {
  const commands = [];
  const commandsPath = path.join(__dirname, "commands");

  if (!fs.existsSync(commandsPath)) {
    console.error("❌ Commands directory not found:", commandsPath);
    return commands;
  }

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    try {
      const command = await import(`file://${filePath}`);

      if ("data" in command) {
        commands.push(command.data.toJSON());
        console.log(`📦 Loaded: ${command.data.name}`);
      } else {
        console.warn(`⚠️ Skipping ${file} - missing "data" property`);
      }
    } catch (error) {
      console.error(`❌ Error loading ${file}:`, error);
    }
  }

  return commands;
}

/**
 * Deploy commands to Discord
 */
async function deployCommands() {
  console.log("🚀 Starting command deployment...\n");

  try {
    // Load all command data
    const commands = await loadCommandsData();

    if (commands.length === 0) {
      console.error("❌ No commands found to deploy");
      return;
    }

    console.log(`\n📋 Found ${commands.length} command(s) to deploy\n`);

    // Create REST instance
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    if (guildId) {
      // Deploy to specific guild (faster for testing)
      console.log(`🎯 Deploying to guild: ${guildId}`);

      const data = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands }
      );

      console.log(
        `\n✅ Successfully deployed ${data.length} command(s) to guild ${guildId}`
      );
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      console.log("🌐 Deploying globally (may take up to 1 hour to propagate)");

      const data = await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );

      console.log(
        `\n✅ Successfully deployed ${data.length} command(s) globally`
      );
    }

    console.log("\n📝 Deployed commands:");
    for (const cmd of commands) {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
    }
  } catch (error) {
    console.error("❌ Error deploying commands:", error);

    if (error.code === 50001) {
      console.error("\n⚠️ Bot is missing access. Make sure:");
      console.error("   1. The bot is invited to the server");
      console.error('   2. The bot has "applications.commands" scope');
    }
  }
}

// Run deployment
deployCommands();

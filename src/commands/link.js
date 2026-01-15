/**
 * Link Codeforces Command
 *
 * Initiates the verification process for a Codeforces account.
 *
 * Verification Flow:
 * 1. User runs /link codeforces <username>
 * 2. Bot validates the username exists on Codeforces
 * 3. Bot selects a random problem and stores pending verification
 * 4. User submits a Compilation Error to that problem
 * 5. User runs /verify to complete verification
 */

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { validateUser, getUserInfo } from "../services/codeforces.service.js";
import {
  createPendingVerification,
  isAccountLinkedByOther,
  getLinkedAccounts,
} from "../services/supabase.client.js";
import { getRandomCodeforcesProblem } from "../utils/randomProblem.js";
import { getExpirationTime, getRemainingTime } from "../utils/time.js";

export const data = new SlashCommandBuilder()
  .setName("link")
  .setDescription("Link your competitive programming accounts")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("codeforces")
      .setDescription("Link your Codeforces account")
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Your Codeforces handle/username")
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(24)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("codechef")
      .setDescription("Link your CodeChef account")
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Your CodeChef username")
          .setRequired(true)
          .setMinLength(3)
          .setMaxLength(24)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("status").setDescription("View your linked accounts")
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case "codeforces":
        await handleLinkCodeforces(interaction);
        break;
      case "codechef":
        await handleLinkCodechef(interaction);
        break;
      case "status":
        await handleStatus(interaction);
        break;
    }
  } catch (error) {
    console.error("Link command error:", error);

    const errorMessage = error.message || "An unexpected error occurred.";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: `❌ Error: ${errorMessage}`,
      });
    } else {
      await interaction.reply({
        content: `❌ Error: ${errorMessage}`,
      });
    }
  }
}

/**
 * Handle Codeforces account linking
 */
async function handleLinkCodeforces(interaction) {
  await interaction.deferReply();

  const username = interaction.options.getString("username");
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Step 1: Validate the username exists on Codeforces
  const userExists = await validateUser(username);
  if (!userExists) {
    return await interaction.editReply({
      content: `❌ Codeforces user **${username}** not found.\n\nPlease check the username and try again.`,
    });
  }

  // Step 2: Check if this account is already linked by another user
  const isLinkedByOther = await isAccountLinkedByOther(
    guildId,
    "codeforces",
    username,
    userId
  );
  if (isLinkedByOther) {
    return await interaction.editReply({
      content: `❌ The Codeforces account **${username}** is already linked to another Discord user in this server.`,
    });
  }

  // Step 3: Get user info for display
  let userInfo;
  try {
    userInfo = await getUserInfo(username);
  } catch {
    userInfo = { handle: username, rank: "unknown", rating: 0 };
  }

  // Step 4: Select a random problem
  const problem = await getRandomCodeforcesProblem();

  // Step 5: Calculate expiration time
  const expiresAt = getExpirationTime();
  const remaining = getRemainingTime(expiresAt);

  // Step 6: Store pending verification in database
  await createPendingVerification({
    discord_user_id: userId,
    guild_id: guildId,
    platform: "codeforces",
    username: userInfo.handle, // Use the exact handle from CF API
    problem_id: problem.id,
    problem_url: problem.url,
    problem_name: problem.name,
    expires_at: expiresAt.toISOString(),
  });

  // Step 7: Create the verification embed
  const embed = new EmbedBuilder()
    .setTitle("🔗 Codeforces Verification")
    .setColor(0x1f8acb) // Codeforces blue
    .setDescription(
      `To verify you own the Codeforces account **${userInfo.handle}**, you need to submit a **Compilation Error** to the problem below.`
    )
    .addFields(
      {
        name: "📝 Problem",
        value: `[${problem.name}](${problem.url})`,
        inline: true,
      },
      {
        name: "⭐ Difficulty",
        value: `${problem.rating}`,
        inline: true,
      },
      {
        name: "⏱️ Time Limit",
        value: remaining.formatted,
        inline: true,
      },
      {
        name: "📊 Your Current Stats",
        value: `**Rank:** ${userInfo.rank}\n**Rating:** ${userInfo.rating}`,
        inline: false,
      },
      {
        name: "📋 Instructions",
        value: `1. Go to the problem: [Click Here](${problem.url})\n2. Submit any code that causes a **Compilation Error**\n   (e.g., \`int main( { }\` or just \`error\`)\n3. Run \`/verify\` to complete verification`,
        inline: false,
      }
    )
    .setFooter({
      text: `Verification expires in ${remaining.formatted}`,
    })
    .setTimestamp(expiresAt);

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle CodeChef account linking
 */
async function handleLinkCodechef(interaction) {
  // Import CodeChef service dynamically to avoid circular dependencies
  const codechefService = await import("../services/codechef.service.js");
  const { getRandomCodeChefProblem } = await import(
    "../utils/randomProblem.js"
  );

  await interaction.deferReply();

  const username = interaction.options.getString("username");
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Step 1: Validate the username exists on CodeChef
  const userExists = await codechefService.validateUser(username);
  if (!userExists) {
    return await interaction.editReply({
      content: `❌ CodeChef user **${username}** not found.\n\nPlease check the username and try again.`,
    });
  }

  // Step 2: Check if this account is already linked by another user
  const isLinkedByOther = await isAccountLinkedByOther(
    guildId,
    "codechef",
    username,
    userId
  );
  if (isLinkedByOther) {
    return await interaction.editReply({
      content: `❌ The CodeChef account **${username}** is already linked to another Discord user in this server.`,
    });
  }

  // Step 3: Get user info for display
  let userInfo;
  try {
    userInfo = await codechefService.getUserInfo(username);
  } catch {
    userInfo = { username: username, rating: 0, stars: 0 };
  }

  // Step 4: Select a random problem
  const problem = await getRandomCodeChefProblem();

  // Step 5: Calculate expiration time
  const expiresAt = getExpirationTime();
  const remaining = getRemainingTime(expiresAt);

  // Step 6: Store pending verification in database
  await createPendingVerification({
    discord_user_id: userId,
    guild_id: guildId,
    platform: "codechef",
    username: username,
    problem_id: problem.id,
    problem_url: problem.url,
    problem_name: problem.name,
    expires_at: expiresAt.toISOString(),
  });

  // Step 7: Create the verification embed
  const embed = new EmbedBuilder()
    .setTitle("🔗 CodeChef Verification")
    .setColor(0x5b4638) // CodeChef brown
    .setDescription(
      `To verify you own the CodeChef account **${username}**, you need to submit a **Compilation Error** to the problem below.`
    )
    .addFields(
      {
        name: "📝 Problem",
        value: `[${problem.name}](${problem.url})`,
        inline: true,
      },
      {
        name: "🏷️ Problem Code",
        value: problem.id,
        inline: true,
      },
      {
        name: "⏱️ Time Limit",
        value: remaining.formatted,
        inline: true,
      },
      {
        name: "📊 Your Stats",
        value: `**Rating:** ${userInfo.rating}\n**Stars:** ${
          "⭐".repeat(userInfo.stars) || "N/A"
        }`,
        inline: false,
      },
      {
        name: "📋 Instructions",
        value: `1. Go to the problem: [Click Here](${problem.url})\n2. Submit any code that causes a **Compilation Error**\n   (e.g., \`int main( { }\` or just \`syntax error\`)\n3. Run \`/verify\` to complete verification`,
        inline: false,
      }
    )
    .setFooter({
      text: `Verification expires in ${remaining.formatted}`,
    })
    .setTimestamp(expiresAt);

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle status command - show linked accounts
 */
async function handleStatus(interaction) {
  await interaction.deferReply({});

  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  const accounts = await getLinkedAccounts(userId, guildId);

  if (!accounts || accounts.length === 0) {
    return await interaction.editReply({
      content:
        "📋 You have no linked competitive programming accounts.\n\nUse `/link codeforces <username>` or `/link codechef <username>` to link your accounts.",
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("🔗 Your Linked Accounts")
    .setColor(0x00ff00)
    .setDescription("Here are your verified competitive programming accounts:");

  // Group by platform
  const codeforces = accounts.filter((a) => a.platform === "codeforces");
  const codechef = accounts.filter((a) => a.platform === "codechef");

  if (codeforces.length > 0) {
    const cfList = codeforces
      .map((a) => {
        const rank = a.rank ? ` (${a.rank})` : "";
        return `• **${a.username}**${rank}`;
      })
      .join("\n");

    embed.addFields({
      name: "🟦 Codeforces",
      value: cfList,
      inline: true,
    });
  }

  if (codechef.length > 0) {
    const ccList = codechef.map((a) => `• **${a.username}**`).join("\n");

    embed.addFields({
      name: "🟫 CodeChef",
      value: ccList,
      inline: true,
    });
  }

  embed.setFooter({
    text: `Total: ${accounts.length} account(s)`,
  });

  await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };

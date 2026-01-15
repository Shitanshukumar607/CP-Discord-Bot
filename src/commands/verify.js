/**
 * Verify Command
 *
 * Completes the verification process by checking if the user
 * has submitted a Compilation Error to the assigned problem.
 *
 * Verification Flow:
 * 1. User runs /verify
 * 2. Bot fetches user's pending verifications
 * 3. Bot checks if CE was submitted to the required problem
 * 4. If verified: assign roles, save to linked_accounts, cleanup
 * 5. If not: provide feedback on why verification failed
 */

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import * as codeforcesService from "../services/codeforces.service.js";
import * as codechefService from "../services/codechef.service.js";
import {
  getPendingVerifications,
  deletePendingVerification,
  createLinkedAccount,
} from "../services/supabase.client.js";
import { assignVerificationRoles } from "../utils/roleManager.js";
import { isExpired, getRemainingTime } from "../utils/time.js";

export const data = new SlashCommandBuilder()
  .setName("verify")
  .setDescription("Complete your CP account verification")
  .addStringOption((option) =>
    option
      .setName("platform")
      .setDescription(
        "Which platform to verify (optional - verifies all pending if not specified)"
      )
      .setRequired(false)
      .addChoices(
        { name: "Codeforces", value: "codeforces" },
        { name: "CodeChef", value: "codechef" }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();

  try {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const platformFilter = interaction.options.getString("platform");

    // Step 1: Get pending verifications
    let pendingVerifications = await getPendingVerifications(userId, guildId);

    // Filter by platform if specified
    if (platformFilter) {
      pendingVerifications = pendingVerifications.filter(
        (v) => v.platform === platformFilter
      );
    }

    // Check if there are any pending verifications
    if (!pendingVerifications || pendingVerifications.length === 0) {
      return await interaction.editReply({
        content:
          "❌ You have no pending verifications.\n\nUse `/link codeforces <username>` or `/link codechef <username>` to start the verification process.",
      });
    }

    // Step 2: Process each pending verification
    const results = [];

    for (const pending of pendingVerifications) {
      // Check if verification has expired
      if (isExpired(pending.expires_at)) {
        await deletePendingVerification(pending.id);
        results.push({
          platform: pending.platform,
          username: pending.username,
          success: false,
          message:
            "Verification expired. Please start a new verification with `/link`.",
        });
        continue;
      }

      // Attempt to verify based on platform
      let verificationResult;
      let userRank = null;

      try {
        if (pending.platform === "codeforces") {
          // Parse problem ID to get contestId and index
          const { contestId, index } = parseCodeforcesProblemId(
            pending.problem_id
          );

          verificationResult =
            await codeforcesService.checkCompilationErrorSubmission(
              pending.username,
              contestId,
              index,
              pending.started_at
            );

          // Get user rank for role assignment
          if (verificationResult.verified) {
            try {
              userRank = await codeforcesService.getUserRank(pending.username);
            } catch {
              console.log("Could not fetch user rank, continuing without it");
            }
          }
        } else if (pending.platform === "codechef") {
          verificationResult =
            await codechefService.checkCompilationErrorSubmission(
              pending.username,
              pending.problem_id,
              pending.started_at
            );
        }
      } catch (error) {
        console.error(`Error verifying ${pending.platform}:`, error);
        results.push({
          platform: pending.platform,
          username: pending.username,
          success: false,
          message: `Failed to check submissions: ${error.message}`,
        });
        continue;
      }

      // Process verification result
      if (verificationResult && verificationResult.verified) {
        // SUCCESS! Create linked account and assign roles
        try {
          // Save to database
          await createLinkedAccount({
            discord_user_id: userId,
            guild_id: guildId,
            platform: pending.platform,
            username: pending.username,
            rank: userRank,
          });

          // Delete pending verification
          await deletePendingVerification(pending.id);

          // Assign roles
          const member = interaction.member;
          const roleResults = await assignVerificationRoles(
            member,
            guildId,
            pending.platform,
            userRank
          );

          results.push({
            platform: pending.platform,
            username: pending.username,
            success: true,
            message: "Account verified successfully!",
            rank: userRank,
            rolesAssigned: roleResults,
          });
        } catch (error) {
          console.error("Error saving verified account:", error);
          results.push({
            platform: pending.platform,
            username: pending.username,
            success: false,
            message: `Verification successful but failed to save: ${error.message}`,
          });
        }
      } else {
        // Verification not complete
        const remaining = getRemainingTime(pending.expires_at);
        results.push({
          platform: pending.platform,
          username: pending.username,
          success: false,
          message:
            verificationResult?.message ||
            "No valid Compilation Error submission found.",
          problemUrl: pending.problem_url,
          problemName: pending.problem_name,
          timeRemaining: remaining.formatted,
        });
      }
    }

    // Step 3: Build response
    await sendVerificationResults(interaction, results);
  } catch (error) {
    console.error("Verify command error:", error);
    await interaction.editReply({
      content: `❌ An error occurred during verification: ${error.message}`,
    });
  }
}

/**
 * Parse Codeforces problem ID to get contestId and index
 * @param {string} problemId - Problem ID (e.g., "1A", "1234B")
 * @returns {Object} Object with contestId and index
 */
function parseCodeforcesProblemId(problemId) {
  // Problem IDs are formatted as <contestId><index>
  // Examples: "1A", "1234B", "1800A1"
  const match = problemId.match(/^(\d+)([A-Za-z]\d*)$/);

  if (!match) {
    throw new Error(`Invalid problem ID format: ${problemId}`);
  }

  return {
    contestId: parseInt(match[1]),
    index: match[2].toUpperCase(),
  };
}

/**
 * Send formatted verification results to user
 * @param {Interaction} interaction - Discord interaction
 * @param {Array} results - Array of verification results
 */
async function sendVerificationResults(interaction, results) {
  const embeds = [];

  // Count successes and failures
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  if (successes.length > 0) {
    const successEmbed = new EmbedBuilder()
      .setTitle("✅ Verification Successful!")
      .setColor(0x00ff00)
      .setDescription("The following accounts have been verified:");

    for (const result of successes) {
      const platformEmoji = result.platform === "codeforces" ? "🟦" : "🟫";
      const platformName =
        result.platform.charAt(0).toUpperCase() + result.platform.slice(1);

      let value = `Account verified!`;
      if (result.rank) {
        value += `\n**Rank:** ${result.rank}`;
      }
      if (result.rolesAssigned?.verifiedRole) {
        value += `\n✓ Verified role assigned`;
      }
      if (result.rolesAssigned?.rankRole) {
        value += `\n✓ Rank role assigned`;
      }

      successEmbed.addFields({
        name: `${platformEmoji} ${platformName}: ${result.username}`,
        value: value,
        inline: false,
      });
    }

    embeds.push(successEmbed);
  }

  if (failures.length > 0) {
    const failureEmbed = new EmbedBuilder()
      .setTitle("⚠️ Verification Incomplete")
      .setColor(0xffa500)
      .setDescription("The following verifications could not be completed:");

    for (const result of failures) {
      const platformEmoji = result.platform === "codeforces" ? "🟦" : "🟫";
      const platformName =
        result.platform.charAt(0).toUpperCase() + result.platform.slice(1);

      let value = result.message;

      if (result.problemUrl) {
        value += `\n\n**Problem:** [${result.problemName || "Click here"}](${
          result.problemUrl
        })`;
      }
      if (result.timeRemaining && result.timeRemaining !== "Expired") {
        value += `\n**Time remaining:** ${result.timeRemaining}`;
      }

      failureEmbed.addFields({
        name: `${platformEmoji} ${platformName}: ${result.username}`,
        value: value,
        inline: false,
      });
    }

    if (
      failures.some((f) => f.timeRemaining && f.timeRemaining !== "Expired")
    ) {
      failureEmbed.setFooter({
        text: "💡 Submit a Compilation Error to the problem, then run /verify again",
      });
    }

    embeds.push(failureEmbed);
  }

  await interaction.editReply({ embeds });
}

export default { data, execute };

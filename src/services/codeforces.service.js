/**
 * Codeforces Service
 *
 * Handles all interactions with the Codeforces API including:
 * - User validation
 * - Fetching user information and rank
 * - Checking submissions for compilation errors
 */

import axios from "axios";
import { isSubmissionAfterStart } from "../utils/time.js";

const CODEFORCES_API_BASE = "https://codeforces.com/api";

// Rate limiting: Codeforces allows ~5 requests per second
const REQUEST_DELAY = 250; // ms between requests
let lastRequestTime = 0;

/**
 * Wait to respect rate limits
 */
async function respectRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < REQUEST_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
}

/**
 * Make a rate-limited request to Codeforces API
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} API response data
 */
async function makeRequest(endpoint, params = {}) {
  await respectRateLimit();

  try {
    const response = await axios.get(`${CODEFORCES_API_BASE}${endpoint}`, {
      params,
      timeout: 15000,
    });

    if (response.data.status !== "OK") {
      throw new Error(response.data.comment || "Codeforces API error");
    }

    return response.data.result;
  } catch (error) {
    if (error.response) {
      // Codeforces returned an error response
      const message = error.response.data?.comment || error.message;
      throw new Error(`Codeforces API error: ${message}`);
    }
    if (error.code === "ECONNABORTED") {
      throw new Error("Codeforces API request timed out");
    }
    throw error;
  }
}

/**
 * Validate if a Codeforces user exists
 * @param {string} username - Codeforces handle
 * @returns {Promise<boolean>} True if user exists
 */
export async function validateUser(username) {
  try {
    await makeRequest("/user.info", { handles: username });
    return true;
  } catch (error) {
    if (error.message.includes("not found")) {
      return false;
    }
    throw error;
  }
}

/**
 * Get Codeforces user information
 * @param {string} username - Codeforces handle
 * @returns {Promise<Object>} User info object
 */
export async function getUserInfo(username) {
  try {
    const users = await makeRequest("/user.info", { handles: username });

    if (!users || users.length === 0) {
      throw new Error(`User "${username}" not found`);
    }

    const user = users[0];

    return {
      handle: user.handle,
      rank: user.rank || "unrated",
      rating: user.rating || 0,
      maxRank: user.maxRank || "unrated",
      maxRating: user.maxRating || 0,
      avatar: user.avatar,
      titlePhoto: user.titlePhoto,
    };
  } catch (error) {
    if (error.message.includes("not found")) {
      throw new Error(`Codeforces user "${username}" not found`);
    }
    throw error;
  }
}

/**
 * Get recent submissions for a user
 * @param {string} username - Codeforces handle
 * @param {number} count - Number of submissions to fetch
 * @returns {Promise<Array>} Array of submissions
 */
export async function getRecentSubmissions(username, count = 10) {
  try {
    const submissions = await makeRequest("/user.status", {
      handle: username,
      from: 1,
      count,
    });

    return submissions.map((sub) => ({
      id: sub.id,
      contestId: sub.problem.contestId,
      problemIndex: sub.problem.index,
      problemName: sub.problem.name,
      verdict: sub.verdict,
      creationTimeSeconds: sub.creationTimeSeconds,
      programmingLanguage: sub.programmingLanguage,
    }));
  } catch (error) {
    console.error("Error fetching submissions:", error.message);
    throw error;
  }
}

/**
 * Check if user has submitted a Compilation Error to a specific problem
 * after a given timestamp.
 *
 * This is the core verification logic for Codeforces.
 *
 * @param {string} username - Codeforces handle
 * @param {number} contestId - Contest ID of the problem
 * @param {string} problemIndex - Problem index (A, B, C, etc.)
 * @param {string|Date} startedAt - Verification start timestamp
 * @returns {Promise<Object>} Verification result
 */
export async function checkCompilationErrorSubmission(
  username,
  contestId,
  problemIndex,
  startedAt
) {
  try {
    // Fetch recent submissions (last 20 to be safe)
    const submissions = await getRecentSubmissions(username, 20);

    // Find a matching CE submission
    const matchingSubmission = submissions.find((sub) => {
      // Check if it's the correct problem
      const isProblemMatch =
        sub.contestId === contestId &&
        sub.problemIndex.toUpperCase() === problemIndex.toUpperCase();

      // Check if verdict is Compilation Error
      const isCompilationError = sub.verdict === "COMPILATION_ERROR";

      // Check if submission was made after verification started
      const isAfterStart = isSubmissionAfterStart(
        sub.creationTimeSeconds,
        startedAt
      );

      return isProblemMatch && isCompilationError && isAfterStart;
    });

    if (matchingSubmission) {
      return {
        verified: true,
        submission: matchingSubmission,
        message: "Compilation Error submission found!",
      };
    }

    // Check if there are any submissions to the problem (but wrong verdict)
    const anyProblemSubmission = submissions.find(
      (sub) =>
        sub.contestId === contestId &&
        sub.problemIndex.toUpperCase() === problemIndex.toUpperCase() &&
        isSubmissionAfterStart(sub.creationTimeSeconds, startedAt)
    );

    if (anyProblemSubmission) {
      return {
        verified: false,
        submission: anyProblemSubmission,
        message: `Found submission but verdict was "${anyProblemSubmission.verdict}" instead of "COMPILATION_ERROR"`,
      };
    }

    return {
      verified: false,
      submission: null,
      message: "No submission found to the specified problem",
    };
  } catch (error) {
    console.error("Error checking CE submission:", error.message);
    throw error;
  }
}

/**
 * Get user's current rank
 * @param {string} username - Codeforces handle
 * @returns {Promise<string>} User's rank
 */
export async function getUserRank(username) {
  const userInfo = await getUserInfo(username);
  return userInfo.rank;
}

/**
 * Generate problem URL from contest ID and index
 * @param {number} contestId - Contest ID
 * @param {string} index - Problem index
 * @returns {string} Problem URL
 */
export function getProblemUrl(contestId, index) {
  return `https://codeforces.com/problemset/problem/${contestId}/${index}`;
}

export default {
  validateUser,
  getUserInfo,
  getRecentSubmissions,
  checkCompilationErrorSubmission,
  getUserRank,
  getProblemUrl,
};

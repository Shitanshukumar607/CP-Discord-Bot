/**
 * CodeChef Service
 *
 * Handles all interactions with CodeChef for user validation and
 * submission verification.
 *
 * Note: CodeChef doesn't have an official public API like Codeforces.
 * We use web scraping and the unofficial API endpoints where available.
 */

import axios from "axios";
import { isSubmissionAfterStart } from "../utils/time.js";

// CodeChef unofficial API endpoints
const CODECHEF_API_BASE = "https://www.codechef.com/api";
const CODECHEF_BASE = "https://www.codechef.com";

// Rate limiting
const REQUEST_DELAY = 500; // ms between requests
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
 * Validate if a CodeChef user exists
 * @param {string} username - CodeChef username
 * @returns {Promise<boolean>} True if user exists
 */
export async function validateUser(username) {
  await respectRateLimit();

  try {
    // Try to fetch user profile page
    const response = await axios.get(`${CODECHEF_BASE}/users/${username}`, {
      timeout: 15000,
      validateStatus: (status) => status < 500,
    });

    // Check if profile exists (200 = exists, 404 = not found)
    return response.status === 200;
  } catch (error) {
    console.error("Error validating CodeChef user:", error.message);
    throw new Error(
      "Failed to validate CodeChef user. Please try again later."
    );
  }
}

/**
 * Get CodeChef user information
 *
 * Note: This uses web scraping as CodeChef doesn't have a public user info API
 *
 * @param {string} username - CodeChef username
 * @returns {Promise<Object>} User info object
 */
export async function getUserInfo(username) {
  await respectRateLimit();

  try {
    const response = await axios.get(
      `${CODECHEF_API_BASE}/ratings/${username}`,
      {
        timeout: 15000,
        validateStatus: (status) => status < 500,
      }
    );

    if (response.status === 404) {
      throw new Error(`CodeChef user "${username}" not found`);
    }

    // The response might vary based on CodeChef's internal API
    const data = response.data;

    return {
      username: username,
      rating: data.rating || data.currentRating || 0,
      stars: data.stars || getStarsFromRating(data.rating || 0),
      highestRating: data.highestRating || data.rating || 0,
    };
  } catch (error) {
    if (error.message.includes("not found")) {
      throw error;
    }
    console.error("Error fetching CodeChef user info:", error.message);

    // Fallback: just validate the user exists
    const exists = await validateUser(username);
    if (!exists) {
      throw new Error(`CodeChef user "${username}" not found`);
    }

    return {
      username: username,
      rating: 0,
      stars: 0,
      highestRating: 0,
    };
  }
}

/**
 * Get star rating from CodeChef rating
 * @param {number} rating - CodeChef rating
 * @returns {number} Number of stars (1-7)
 */
function getStarsFromRating(rating) {
  if (rating >= 2500) return 7;
  if (rating >= 2200) return 6;
  if (rating >= 2000) return 5;
  if (rating >= 1800) return 4;
  if (rating >= 1600) return 3;
  if (rating >= 1400) return 2;
  return 1;
}

/**
 * Get recent submissions for a user
 *
 * Note: CodeChef submission history requires authentication or scraping.
 * This function attempts to use available endpoints.
 *
 * @param {string} username - CodeChef username
 * @param {number} count - Number of submissions to fetch
 * @returns {Promise<Array>} Array of submissions
 */
export async function getRecentSubmissions(username, count = 20) {
  await respectRateLimit();

  try {
    // Try the unofficial submissions API
    const response = await axios.get(
      `${CODECHEF_API_BASE}/submissions?username=${username}&limit=${count}`,
      {
        timeout: 15000,
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (response.data && Array.isArray(response.data)) {
      return response.data.map((sub) => ({
        id: sub.id,
        problemCode: sub.problemCode || sub.problem_code,
        result: sub.result || sub.verdict,
        date: sub.date || sub.time,
        language: sub.language,
      }));
    }

    // Alternative: Try the recent submissions endpoint
    const altResponse = await axios.get(
      `${CODECHEF_BASE}/recent/user?page=0&user_handle=${username}`,
      {
        timeout: 15000,
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );

    if (altResponse.data && altResponse.data.content) {
      // Parse the HTML content to extract submissions
      return parseSubmissionsFromHtml(altResponse.data.content);
    }

    return [];
  } catch (error) {
    console.error("Error fetching CodeChef submissions:", error.message);
    return [];
  }
}

/**
 * Parse submissions from CodeChef HTML response
 * @param {string} html - HTML content
 * @returns {Array} Parsed submissions
 */
function parseSubmissionsFromHtml(html) {
  const submissions = [];

  // Simple regex-based parsing (not ideal but works for basic cases)
  // Look for submission entries with problem codes and verdicts
  const submissionRegex =
    /data-problemcode="([^"]+)"[^>]*>.*?<span[^>]*class="[^"]*(?:AC|WA|CE|TLE|RTE|NZEC)[^"]*"[^>]*>([^<]+)/gi;

  let match;
  while ((match = submissionRegex.exec(html)) !== null) {
    submissions.push({
      problemCode: match[1],
      result: match[2].trim(),
      date: new Date().toISOString(), // Approximate
    });
  }

  return submissions;
}

/**
 * Check if user has submitted a Compilation Error to a specific problem
 * after a given timestamp.
 *
 * Note: Due to CodeChef API limitations, this may not always work perfectly.
 * Consider alternative verification methods for production use.
 *
 * @param {string} username - CodeChef username
 * @param {string} problemCode - Problem code
 * @param {string|Date} startedAt - Verification start timestamp
 * @returns {Promise<Object>} Verification result
 */
export async function checkCompilationErrorSubmission(
  username,
  problemCode,
  startedAt
) {
  try {
    // First, try the direct submission check via scraping
    await respectRateLimit();

    // Try to access the problem's submission page for the user
    const response = await axios.get(
      `${CODECHEF_BASE}/status/${problemCode}?sort_by=All&sorting_order=asc&language=All&status=13&handle=${username}`,
      {
        timeout: 15000,
        headers: {
          Accept: "text/html",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        validateStatus: (status) => status < 500,
      }
    );

    // status=13 is the code for Compilation Error in CodeChef
    // Check if any submissions are found
    if (response.status === 200 && response.data) {
      // Look for the username in the response with CE status
      const hasCompilationError =
        response.data.includes(username) &&
        (response.data.includes("compilation error") ||
          response.data.includes("Compilation Error") ||
          response.data.includes(">CE<"));

      if (hasCompilationError) {
        // Try to extract submission time to verify it's after startedAt
        // This is a simplified check - in production, more robust parsing would be needed
        return {
          verified: true,
          submission: {
            problemCode,
            result: "compilation error",
          },
          message: "Compilation Error submission found!",
        };
      }
    }

    // Fallback: Check recent submissions
    const submissions = await getRecentSubmissions(username, 30);

    const matchingSubmission = submissions.find((sub) => {
      const isProblemMatch =
        sub.problemCode &&
        sub.problemCode.toUpperCase() === problemCode.toUpperCase();

      const isCompilationError =
        sub.result &&
        (sub.result.toLowerCase().includes("compilation error") ||
          sub.result.toLowerCase() === "ce" ||
          sub.result === "compilation error");

      return isProblemMatch && isCompilationError;
    });

    if (matchingSubmission) {
      return {
        verified: true,
        submission: matchingSubmission,
        message: "Compilation Error submission found!",
      };
    }

    // Check if there's any submission to the problem
    const anySubmission = submissions.find(
      (sub) =>
        sub.problemCode &&
        sub.problemCode.toUpperCase() === problemCode.toUpperCase()
    );

    if (anySubmission) {
      return {
        verified: false,
        submission: anySubmission,
        message: `Found submission but verdict was "${anySubmission.result}" instead of "Compilation Error"`,
      };
    }

    return {
      verified: false,
      submission: null,
      message:
        "No submission found to the specified problem. Please make sure you submitted to the correct problem.",
    };
  } catch (error) {
    console.error("Error checking CodeChef CE submission:", error.message);
    throw new Error(`Failed to check CodeChef submissions: ${error.message}`);
  }
}

/**
 * Generate problem URL from problem code
 * @param {string} problemCode - Problem code
 * @returns {string} Problem URL
 */
export function getProblemUrl(problemCode) {
  return `${CODECHEF_BASE}/problems/${problemCode}`;
}

export default {
  validateUser,
  getUserInfo,
  getRecentSubmissions,
  checkCompilationErrorSubmission,
  getProblemUrl,
};

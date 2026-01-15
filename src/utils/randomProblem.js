/**
 * Random Problem Selector
 *
 * Utilities for selecting random problems from Codeforces and CodeChef
 * for the verification process.
 */

import axios from "axios";

// Codeforces problem difficulty range (rating)
const CF_MIN_RATING = 800;
const CF_MAX_RATING = 1500;

// Cache for Codeforces problems (to reduce API calls)
let cfProblemsCache = null;
let cfCacheTimestamp = null;
const CF_CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Fetch and cache Codeforces problems
 * @returns {Promise<Array>} Array of Codeforces problems
 */
async function fetchCodeforcesProblems() {
  // Return cached problems if still valid
  if (
    cfProblemsCache &&
    cfCacheTimestamp &&
    Date.now() - cfCacheTimestamp < CF_CACHE_DURATION
  ) {
    return cfProblemsCache;
  }

  try {
    const response = await axios.get(
      "https://codeforces.com/api/problemset.problems",
      {
        timeout: 10000,
      }
    );

    if (response.data.status !== "OK") {
      throw new Error("Codeforces API returned non-OK status");
    }

    // Filter problems by rating (easy to medium difficulty)
    const problems = response.data.result.problems.filter((problem) => {
      return (
        problem.rating &&
        problem.rating >= CF_MIN_RATING &&
        problem.rating <= CF_MAX_RATING
      );
    });

    // Cache the problems
    cfProblemsCache = problems;
    cfCacheTimestamp = Date.now();

    return problems;
  } catch (error) {
    console.error("Error fetching Codeforces problems:", error.message);

    // Return cached problems if available, even if stale
    if (cfProblemsCache) {
      console.log("Using stale cache for Codeforces problems");
      return cfProblemsCache;
    }

    throw error;
  }
}

/**
 * Get a random Codeforces problem
 * @returns {Promise<Object>} Problem object with id, name, and url
 */
export async function getRandomCodeforcesProblem() {
  const problems = await fetchCodeforcesProblems();

  if (!problems || problems.length === 0) {
    throw new Error("No Codeforces problems available");
  }

  // Select a random problem
  const randomIndex = Math.floor(Math.random() * problems.length);
  const problem = problems[randomIndex];

  // Construct problem URL
  const problemUrl = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;

  return {
    id: `${problem.contestId}${problem.index}`,
    contestId: problem.contestId,
    index: problem.index,
    name: problem.name,
    rating: problem.rating,
    url: problemUrl,
  };
}

/**
 * Get a random CodeChef problem
 *
 * Note: CodeChef doesn't have a public problems API like Codeforces.
 * We use a curated list of beginner-friendly problems.
 *
 * @returns {Promise<Object>} Problem object with id, name, and url
 */
export async function getRandomCodeChefProblem() {
  // Curated list of CodeChef practice problems (beginner/easy level)
  // These are well-known practice problems that are always available
  const codechefProblems = [
    { id: "TEST", name: "Life, the Universe, and Everything" },
    { id: "INTEST", name: "Enormous Input Test" },
    { id: "HS08TEST", name: "ATM" },
    { id: "FLOW001", name: "Add Two Numbers" },
    { id: "FLOW002", name: "Sum of Digits" },
    { id: "FLOW003", name: "FLOW003" },
    { id: "FLOW004", name: "First and Last Digit" },
    { id: "FLOW005", name: "Smallest Number in the List" },
    { id: "FLOW006", name: "Reversed Number" },
    { id: "FLOW007", name: "Reverse The Number" },
    { id: "FLOW008", name: "FLOW008" },
    { id: "START01", name: "Start Practice" },
    { id: "LADDU", name: "Chef and Laddus" },
    { id: "CARVANS", name: "Carvans" },
    { id: "LTIME", name: "Lucky Time" },
    { id: "CHEFSTUD", name: "Chef and his Students" },
    { id: "CNOTE", name: "Chef and Notebook" },
    { id: "CHOPRT", name: "Chopsticks" },
    { id: "DIFFSUM", name: "Difference Sum" },
    { id: "REMISS", name: "Remove Mission" },
  ];

  // Select a random problem
  const randomIndex = Math.floor(Math.random() * codechefProblems.length);
  const problem = codechefProblems[randomIndex];

  // Construct problem URL
  const problemUrl = `https://www.codechef.com/problems/${problem.id}`;

  return {
    id: problem.id,
    name: problem.name,
    url: problemUrl,
  };
}

/**
 * Validate that a Codeforces problem exists
 * @param {number} contestId - Contest ID
 * @param {string} index - Problem index (A, B, C, etc.)
 * @returns {Promise<boolean>} True if problem exists
 */
export async function validateCodeforcesProblem(contestId, index) {
  try {
    const problems = await fetchCodeforcesProblems();
    return problems.some((p) => p.contestId === contestId && p.index === index);
  } catch {
    return false;
  }
}

export default {
  getRandomCodeforcesProblem,
  getRandomCodeChefProblem,
  validateCodeforcesProblem,
};

/**
 * Time Utility Functions
 *
 * Helper functions for time calculations and formatting
 * used throughout the verification process.
 */

import dotenv from "dotenv";

dotenv.config();

// Default verification timeout in minutes
const VERIFICATION_TIMEOUT = parseInt(process.env.VERIFICATION_TIMEOUT) || 10;

/**
 * Calculate expiration timestamp for verification
 * @param {number} minutes - Minutes until expiration (default: VERIFICATION_TIMEOUT)
 * @returns {Date} Expiration date
 */
export function getExpirationTime(minutes = VERIFICATION_TIMEOUT) {
	const expiration = new Date();
	expiration.setMinutes(expiration.getMinutes() + minutes);
	return expiration;
}

/**
 * Check if a timestamp has expired
 * @param {string|Date} expiresAt - Expiration timestamp
 * @returns {boolean} True if expired
 */
export function isExpired(expiresAt) {
	const expiration = new Date(expiresAt);
	return new Date() > expiration;
}

/**
 * Get remaining time until expiration
 * @param {string|Date} expiresAt - Expiration timestamp
 * @returns {Object} Object with minutes and seconds remaining
 */
export function getRemainingTime(expiresAt) {
	const expiration = new Date(expiresAt);
	const now = new Date();
	const diff = expiration - now;

	if (diff <= 0) {
		return { minutes: 0, seconds: 0, formatted: "Expired" };
	}

	const minutes = Math.floor(diff / 60000);
	const seconds = Math.floor((diff % 60000) / 1000);

	return {
		minutes,
		seconds,
		formatted: `${minutes}m ${seconds}s`,
	};
}

/**
 * Format a date to a human-readable string
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
	return new Date(date).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZoneName: "short",
	});
}

/**
 * Convert Unix timestamp (seconds) to JavaScript Date
 * @param {number} unixTimestamp - Unix timestamp in seconds
 * @returns {Date} JavaScript Date object
 */
export function fromUnixTimestamp(unixTimestamp) {
	return new Date(unixTimestamp * 1000);
}

/**
 * Get current Unix timestamp in seconds
 * @returns {number} Current Unix timestamp
 */
export function getCurrentUnixTimestamp() {
	return Math.floor(Date.now() / 1000);
}

/**
 * Check if a submission time is after the verification start time
 * @param {number} submissionTime - Unix timestamp of submission (seconds)
 * @param {string|Date} startedAt - Verification start time
 * @returns {boolean} True if submission is after start
 */
export function isSubmissionAfterStart(submissionTime, startedAt) {
	const startTimestamp = Math.floor(new Date(startedAt).getTime() / 1000);
	return submissionTime >= startTimestamp;
}

export default {
	getExpirationTime,
	isExpired,
	getRemainingTime,
	formatDate,
	fromUnixTimestamp,
	getCurrentUnixTimestamp,
	isSubmissionAfterStart,
};

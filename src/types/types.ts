import type { Database } from "./db.types.js";

export type GuidConfig = Database["public"]["Tables"]["guild_config"]["Row"];

export type PendingVerification =
  Database["public"]["Tables"]["pending_verifications"]["Row"];

export type LinkedAccounts = Database["public"]["Tables"]["linked_accounts"]["Row"];

export type CodeforcesRank =
  | "newbie"
  | "pupil"
  | "specialist"
  | "expert"
  | "candidate master"
  | "master"
  | "international master"
  | "grandmaster"
  | "international grandmaster"
  | "legendary grandmaster";

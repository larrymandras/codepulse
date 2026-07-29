/**
 * brainsApi.ts — the D-16 adapter seam for the per-profile brain-swap axis.
 *
 * ALL per-profile brain traffic (catalogue read, swap dispatch) goes through this one module.
 * One env flag, read once at module scope (never per-call), selects between a stub
 * implementation (fixtures from brainsFixtures.ts) and a live implementation (dispatches real
 * WS commands per 103-CONTRACT.md). Everything above this seam — pickers, badges, Settings rows —
 * is written against the shapes exported here, so going live is a flag flip plus this one module,
 * not a rewrite.
 *
 * Scope boundary (D-08/D-16 amendment): this module owns the PER-PROFILE axis only. The GLOBAL
 * brain swap (Ástríðr's live `swap.` command family — set/catalogue/state) already ships and is
 * live — it is NOT routed through this seam and must never be marked as stub data.
 *
 * See .planning/phases/103-brain-swap-control-surface/103-CONTRACT.md for the full shape spec.
 */

import type { AckResponse } from "../contexts/AstridrWSContext";
import { STUB_CATALOGUE, STUB_DEFAULT_PROFILE_ID } from "./brainsFixtures";

// ─── Contract types (mirror 103-CONTRACT.md exactly) ────────────────────────────

export interface CatalogueEntry {
  id: string;
  name: string;
  vendor: string;
  group: "subscription" | "api" | "local";
  billing: "api" | "sub";
  costTier: "normal" | "expensive" | "unknown";
  quotaRemainingPct?: number;
  health?: "reachable" | "degraded" | "unreachable";
}

export interface ActiveEngine {
  profileId: string;
  model: string;
  mode: "session" | "pinned" | "inherited";
  selectionPath: string;
  expiresAt?: number;
  timestamp: number;
}

export interface GatewayModelSetCommand {
  type: "gateway.model.set";
  request_id: string;
  scope: "profile";
  profile_id: string;
  model?: string | null;
  mode: "session" | "default";
  restore?: boolean;
}

export interface BrainsAck {
  type: "ack";
  request_id: string;
  status: "ok" | "error";
  error?: string;
}

// ─── Adapter interface ───────────────────────────────────────────────────────────

export interface BrainsAdapter {
  isStub: boolean;
  getCatalogue(): Promise<CatalogueEntry[]>;
  dispatchSwap(cmd: GatewayModelSetCommand): Promise<BrainsAck>;
  getDefaultProfileId(): Promise<string>;
}

// ─── Shared validation (ASVS V5 contract-drift canary — used by BOTH impls) ──────

/**
 * Validates a `gateway.model.set` command against 103-CONTRACT.md §2/§7 before dispatch.
 * Returns an error `BrainsAck` (never throws) on a malformed shape, or `null` when valid.
 * The stub must be at least as strict as the real server will be.
 */
export function validateGatewayModelSet(cmd: GatewayModelSetCommand): BrainsAck | null {
  if (!cmd.profile_id || cmd.profile_id.trim() === "") {
    return {
      type: "ack",
      request_id: cmd.request_id,
      status: "error",
      error: "profile_id is required",
    };
  }
  if (cmd.scope !== "profile") {
    return {
      type: "ack",
      request_id: cmd.request_id,
      status: "error",
      error: `scope must be "profile", got "${String(cmd.scope)}"`,
    };
  }
  if (!cmd.restore && (!cmd.model || cmd.model.trim() === "")) {
    return {
      type: "ack",
      request_id: cmd.request_id,
      status: "error",
      error: "model is required unless restore is true",
    };
  }
  if (cmd.mode !== "session" && cmd.mode !== "default") {
    return {
      type: "ack",
      request_id: cmd.request_id,
      status: "error",
      error: `mode must be "session" or "default", got "${String(cmd.mode)}"`,
    };
  }
  return null;
}

// ─── Stub implementation ─────────────────────────────────────────────────────────

/**
 * Builds a stub adapter with an injectable failure deny-list, so tests can construct
 * partial-failure scenarios (D-12) without monkey-patching the singleton `stubBrainsAdapter`.
 */
export function createStubBrainsAdapter(failureProfileIds: Set<string> = new Set()): BrainsAdapter {
  return {
    isStub: true,
    async getCatalogue() {
      return STUB_CATALOGUE;
    },
    async dispatchSwap(cmd) {
      const validationError = validateGatewayModelSet(cmd);
      if (validationError) return validationError;
      if (failureProfileIds.has(cmd.profile_id)) {
        return {
          type: "ack",
          request_id: cmd.request_id,
          status: "error",
          error: `No credentials configured for profile "${cmd.profile_id}"`,
        };
      }
      return { type: "ack", request_id: cmd.request_id, status: "ok" };
    },
    async getDefaultProfileId() {
      return STUB_DEFAULT_PROFILE_ID;
    },
  };
}

export const stubBrainsAdapter: BrainsAdapter = createStubBrainsAdapter();

// ─── Live implementation ─────────────────────────────────────────────────────────

type SendCommandFn = (cmd: Record<string, unknown>) => Promise<AckResponse>;

/**
 * Pure factory — takes the WS sender as an argument so this module has no React dependency
 * and stays fully unit-testable (inject a mock sender directly, no provider tree needed).
 */
export function createLiveBrainsAdapter(sendCommand: SendCommandFn): BrainsAdapter {
  return {
    isStub: false,
    async getCatalogue() {
      const ack = await sendCommand({
        type: "models.catalog",
        request_id: crypto.randomUUID(),
      });
      const entries = (ack as unknown as { entries?: unknown }).entries;
      if (ack.status !== "ok" || !Array.isArray(entries)) return [];
      return entries as CatalogueEntry[];
    },
    async dispatchSwap(cmd) {
      const validationError = validateGatewayModelSet(cmd);
      if (validationError) return validationError;
      const ack = await sendCommand(cmd as unknown as Record<string, unknown>);
      return ack as unknown as BrainsAck;
    },
    async getDefaultProfileId() {
      const ack = await sendCommand({
        type: "models.catalog",
        request_id: crypto.randomUUID(),
      });
      const defaultProfileId = (ack as unknown as { default_profile_id?: unknown })
        .default_profile_id;
      if (ack.status === "ok" && typeof defaultProfileId === "string") {
        return defaultProfileId;
      }
      return "";
    },
  };
}

/**
 * The live adapter's sender is not available at module load (it comes from
 * `useAstridrWS().sendCommand`, a React hook). `registerBrainsWsSender` is called once by the
 * app's WS provider tree to wire it up; until then, live dispatch fails with an honest error
 * ack rather than throwing or silently no-oping.
 */
let liveSendCommand: SendCommandFn | null = null;

export function registerBrainsWsSender(sender: SendCommandFn): void {
  liveSendCommand = sender;
}

const liveBrainsAdapter: BrainsAdapter = createLiveBrainsAdapter(async (cmd) => {
  if (!liveSendCommand) {
    return {
      type: "ack",
      request_id: (cmd.request_id as string | undefined) ?? "",
      status: "error",
      error: "Ástríðr WS sender not registered",
    };
  }
  return liveSendCommand(cmd);
});

// ─── Seam selection (D-16: one env flag, read once, module scope) ────────────────

const BRAINS_STUB = import.meta.env.VITE_BRAINS_STUB === "true";

/** Single source of truth for every STUB chip/banner in the UI — no component may derive
 * stub-ness any other way. */
export const BRAINS_STUB_ACTIVE = BRAINS_STUB;

export const brainsApi: BrainsAdapter = BRAINS_STUB ? stubBrainsAdapter : liveBrainsAdapter;

// ─── Model display names (UAT 2026-07-29, cosmetic follow-up) ─────────────────────────────────
//
// Raw model ids were leaking into operator-facing copy in four places while a real display name was
// available: the header badge and Chat composer pill labels ("claude-sonnet-5"), the confirm modal's
// shadowing warning ("anthropic/claude-sonnet-5"), and the revert result ("Reverted to
// claude-haiku-4-5-20251001") — all while the dialog TITLES correctly said "Claude Sonnet 5" /
// "Claude Haiku 4.5".
//
// The confirm-modal case had a real cause, not just a missing lookup: `profileConfigs
// .modelPreferences.primary` is vendor-prefixed ("anthropic/claude-sonnet-5") while live
// `swap.catalogue` ids are not ("claude-sonnet-5"), so an exact id match could never hit. Hence the
// prefix-tolerant match below.
//
// Deliberately does NOT invent a name when the catalogue has no entry: it returns the id unchanged.
// Prettifying an unknown id is unreliable (e.g. "claude-haiku-4-5-20251001" would become "Claude
// Haiku 4 5 20251001", worse than the id) and dressing up an identifier as a product name is the
// same class of dishonesty D-14 exists to prevent.

/** Strips a leading vendor namespace: "anthropic/claude-sonnet-5" -> "claude-sonnet-5". */
function stripVendorPrefix(modelId: string): string {
  const slash = modelId.lastIndexOf("/");
  return slash === -1 ? modelId : modelId.slice(slash + 1);
}

/**
 * Resolves a model id to its catalogue display name, tolerating the vendor-prefix mismatch between
 * config-sourced ids and live catalogue ids. Falls back to the id itself, unchanged, when no
 * catalogue entry matches — never a fabricated name.
 */
export function resolveModelDisplayName(
  modelId: string,
  catalogue: CatalogueEntry[] | null | undefined
): string {
  if (!catalogue || catalogue.length === 0) return modelId;

  const exact = catalogue.find((e) => e.id === modelId);
  if (exact) return exact.name;

  const bare = stripVendorPrefix(modelId);
  const suffix = catalogue.find((e) => stripVendorPrefix(e.id) === bare);
  return suffix ? suffix.name : modelId;
}

/**
 * Builds an id -> display-name map for surfaces that must resolve a name WITHOUT holding the
 * catalogue themselves (GlobalSwapModal resolving the prior override it is reverting to). Includes
 * both the raw and vendor-stripped keys so either id namespace resolves.
 */
export function buildModelNameMap(
  catalogue: CatalogueEntry[] | null | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of catalogue ?? []) {
    map[entry.id] = entry.name;
    const bare = stripVendorPrefix(entry.id);
    if (!(bare in map)) map[bare] = entry.name;
  }
  return map;
}

/**
 * PersonaDialControl — the host component that closes DIAL-02.
 *
 * Resolves the astridr-reported profile via `persona_dials.get_context`
 * (fired once on mount, D-11), reads the live dial values reactively from
 * Convex (`useQuery(api.personaDials.get, ...)`, D-02/D-12), hosts two
 * `PersonaDialSlider`s (195-02) in a popover, and writes ONLY the changed
 * axis back through the single WS write path (`persona_dials.set`, D-01) —
 * never both axes, except Reset (D-13), the one deliberate exception.
 *
 * Structurally the same trigger shape as `BrainControl.tsx` (row/chip
 * variant split, `Popover`/`PopoverTrigger`/`PopoverContent align="end"`,
 * loading `Skeleton` bars) — this component does NOT re-fetch on popover
 * open the way `BrainControl` re-fetches its catalogue, because
 * `get_context` only needs to resolve once per mount; the reactive Convex
 * `useQuery` keeps the dashboard live afterward without any re-fetch.
 *
 * Never sends the sibling axis on a single-axis commit (see
 * `PersonaDialSlider.tsx`'s docstring and 195-03-PLAN.md's rationale): a
 * client-computed sibling value can already be stale by the time a commit
 * lands, and astridr merges the unsent axis server-side inside its own
 * per-profile lock (`PersonaDialsClient.apply`, plan 195-05). This
 * deliberately supersedes 195-UI-SPEC.md's Wiring note and
 * 195-PATTERNS.md's stale both-axes-required example.
 *
 * Never imports Convex's mutation hook and never calls the Convex
 * `personaDials` write function directly — a direct Convex write from
 * `src/` is the second write path D-01 exists to forbid.
 *
 * @see 195-UI-SPEC.md "Layout: Placement in the Control Center" + "Interaction States"
 * @see codepulse/src/components/control-center/PersonaDialSlider.tsx (the axis this component hosts twice)
 * @see codepulse/src/components/control-center/BrainControl.tsx (the trigger/popover shape cloned)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { api } from "../../../convex/_generated/api";
import { resolveBand } from "@/lib/dialBands";
import { formatRelativeTime } from "@/lib/time";
import { PersonaDialSlider } from "./PersonaDialSlider";

// personaId is locked to astridr only (D-12) -- other personas' tone stays
// locked per 185 D-14; this is never user-selectable.
const PERSONA_ID = "astridr";
// The "mid" band both dials describe as their default register
// (DEFAULT_HUMOR/DEFAULT_CANDOR, persona_dials_client.py:100-101).
const DEFAULT_HUMOR = 50;
const DEFAULT_CANDOR = 50;

export interface PersonaDialControlProps {
  /** Trigger visual: full labeled row (default, calm layout) or a compact
   * icon+value chip (command-center strip). Popover content is identical
   * in both. */
  variant?: "row" | "chip";
}

export function PersonaDialControl({ variant = "row" }: PersonaDialControlProps) {
  const { sendCommand } = useAstridrWS();

  // D-11: astridr reports the profileId the next turn will actually
  // resolve under. Fired exactly once on mount -- never re-fired on
  // popover open, never guessed, never a hardcoded literal.
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sendCommand({ type: "persona_dials.get_context" })
      .then((ack) => {
        if (cancelled) return;
        if (ack.status === "ok" && typeof ack.profileId === "string") {
          setProfileId(ack.profileId);
        }
        // A non-ok ack or a missing profileId leaves profileId null --
        // the Convex read stays skipped and the loading state persists.
        // No fallback literal is introduced here.
      })
      .catch(() => {
        // Transport failure -- same as above, stay in the loading state.
      });
    return () => {
      cancelled = true;
    };
    // sendCommand's identity is stable per AstridrWSContext; this effect
    // must fire exactly once per mount, not on every sendCommand render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // D-02/D-12: reactive read, skipped until the ack lands. personaId is the
  // literal "astridr" and is not user-selectable.
  const row = useQuery(
    api.personaDials.get,
    profileId ? { profileId, personaId: PERSONA_ID } : "skip"
  );

  const loading = profileId === null || row === undefined;

  // Local pair state: seeded from the Convex row (or 50/50 when the row is
  // null), re-seeded whenever the Convex read delivers a new value and no
  // write is in flight for that axis.
  const [localHumor, setLocalHumor] = useState(DEFAULT_HUMOR);
  const [localCandor, setLocalCandor] = useState(DEFAULT_CANDOR);
  const pendingAxisRef = useRef({ humor: false, candor: false });

  useEffect(() => {
    if (row === undefined) return; // still loading -- nothing to seed from yet
    if (row === null) {
      if (!pendingAxisRef.current.humor) setLocalHumor(DEFAULT_HUMOR);
      if (!pendingAxisRef.current.candor) setLocalCandor(DEFAULT_CANDOR);
      return;
    }
    if (!pendingAxisRef.current.humor) setLocalHumor(row.humor);
    if (!pendingAxisRef.current.candor) setLocalCandor(row.candor);
  }, [row]);

  // Changed-axis-only write (D-01/T-195-22). `axis` selects which single
  // field is sent -- the sibling is never included. Reconciles BOTH local
  // values from the ack on success (the server may have merged a
  // concurrently-landed spoken change into the unsent axis), and on
  // failure resets THIS axis back to the last Convex-confirmed value so a
  // later sibling commit never carries the failed value forward, then
  // rethrows so PersonaDialSlider's own reject branch performs the visible
  // revert and shows the per-axis error (D-03).
  const commitAxis = useCallback(
    async (axis: "humor" | "candor", newValue: number) => {
      pendingAxisRef.current[axis] = true;
      try {
        const ack = await sendCommand(
          axis === "humor"
            ? { type: "persona_dials.set", humor: newValue }
            : { type: "persona_dials.set", candor: newValue }
        );
        if (ack.status !== "ok") {
          throw new Error(
            typeof ack.error === "string" ? ack.error : "persona_dials.set failed"
          );
        }
        if (typeof ack.humor === "number") setLocalHumor(ack.humor);
        if (typeof ack.candor === "number") setLocalCandor(ack.candor);
      } catch (err) {
        if (axis === "humor") setLocalHumor(row?.humor ?? DEFAULT_HUMOR);
        else setLocalCandor(row?.candor ?? DEFAULT_CANDOR);
        throw err;
      } finally {
        pendingAxisRef.current[axis] = false;
      }
    },
    [sendCommand, row]
  );

  const handleHumorCommit = useCallback((v: number) => commitAxis("humor", v), [commitAxis]);
  const handleCandorCommit = useCallback((v: number) => commitAxis("candor", v), [commitAxis]);

  // D-13: reset both dials to 50/50 through the SAME single write path --
  // one persona_dials.set carrying both axes, the sole deliberate exception
  // to changed-axis-only. Same success/failure handling as a normal commit.
  const handleReset = useCallback(async () => {
    pendingAxisRef.current.humor = true;
    pendingAxisRef.current.candor = true;
    try {
      const ack = await sendCommand({
        type: "persona_dials.set",
        humor: DEFAULT_HUMOR,
        candor: DEFAULT_CANDOR,
      });
      if (ack.status !== "ok") {
        throw new Error(
          typeof ack.error === "string" ? ack.error : "persona_dials.set failed"
        );
      }
      setLocalHumor(typeof ack.humor === "number" ? ack.humor : DEFAULT_HUMOR);
      setLocalCandor(typeof ack.candor === "number" ? ack.candor : DEFAULT_CANDOR);
    } catch {
      setLocalHumor(row?.humor ?? DEFAULT_HUMOR);
      setLocalCandor(row?.candor ?? DEFAULT_CANDOR);
    } finally {
      pendingAxisRef.current.humor = false;
      pendingAxisRef.current.candor = false;
    }
  }, [sendCommand, row]);

  const humorBand = resolveBand(localHumor);
  const candorBand = resolveBand(localCandor);
  const summary = `${humorBand} / ${candorBand}`;
  // Accent tint (Color table: "the trigger's active/non-default background
  // tint... when either dial is off its 50/50 default") -- the summary
  // TEXT itself stays normal weight per the same table; only the trigger's
  // background/border tints.
  const isNonDefault = !loading && (localHumor !== DEFAULT_HUMOR || localCandor !== DEFAULT_CANDOR);

  // D-16: relative last-changed time from epoch SECONDS. Never construct a
  // JS Date directly from `row.updatedAt` -- that renders 1970 dates.
  const timestampLine =
    row === null || row === undefined
      ? "Not yet adjusted"
      : `Changed ${formatRelativeTime(row.updatedAt)}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "chip" ? (
          <button
            type="button"
            aria-label="Persona tone"
            title="Persona tone"
            className={`flex items-center gap-1.5 h-7 px-2 rounded-md border font-mono text-sm whitespace-nowrap ${
              isNonDefault
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/60 bg-muted/30 text-foreground/90"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {!loading && summary}
            <ChevronDown className="h-2.5 w-2.5 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Persona tone"
            className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
              isNonDefault ? "border-primary/30 bg-primary/10" : "border-border/60 bg-muted/30"
            }`}
          >
            <span className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              TONE
            </span>
            <span className="flex items-center gap-1">
              {!loading && (
                <span className="font-mono text-sm text-foreground/90">{summary}</span>
              )}
              <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="flex flex-col gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            PERSONA TONE
          </span>

          {loading ? (
            <div className="flex flex-col gap-4" aria-label="Loading persona tone">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : (
            <>
              <PersonaDialSlider
                axisLabel="HUMOR"
                value={localHumor}
                onCommit={handleHumorCommit}
                disabled={loading}
              />
              <PersonaDialSlider
                axisLabel="CANDOR"
                value={localCandor}
                onCommit={handleCandorCommit}
                disabled={loading}
              />
            </>
          )}

          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            {timestampLine}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-end"
            disabled={loading}
            onClick={() => void handleReset()}
          >
            Reset to default
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default PersonaDialControl;

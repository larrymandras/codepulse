---
phase: 70-external-integrations-call-graph
audited: 2026-05-25
overall_score: 17/24
status: needs_fixes
---

# Phase 70: UI Audit Review

**Baseline:** Abstract 6-pillar standards (no UI-SPEC for this audit)
**Screenshots:** Not captured (no dev server running — code-only audit)
**Files audited:** CallGraphSVG.tsx, CallGraphPanel.tsx, EmailDigestConfig.tsx, DeliveryHistory.tsx, AlertRuleForm.tsx, Settings.tsx, Infrastructure.tsx

---

## Score Summary

| Pillar | Score | Notes |
|--------|-------|-------|
| Copywriting | 3/4 | Spec-matched CTAs and empty states; one minor label ambiguity |
| Visuals | 3/4 | Clear hierarchy in most components; call graph legend color mismatch |
| Color | 3/4 | Hardcoded hex colors throughout SVG component; legend dot color diverges from node color |
| Typography | 3/4 | 5 sizes and 4 weights in use — one size over the 4-size guideline |
| Spacing | 2/4 | Arbitrary Tailwind values across multiple components; inconsistent mt-8 vs mt-12 in Settings |
| Experience Design | 3/4 | Good state coverage overall; DeliveryHistory has no loading state; EmailDigestConfig has no loading skeleton for config fetch |

---

## Findings

### Pillar 1: Copywriting (3/4)

**Passing:** All spec-mandated copy is present and correct.
- "Save Digest Settings" — matches UI-SPEC exactly (EmailDigestConfig.tsx:103)
- "Send email digest" toggle label — matches UI-SPEC exactly (EmailDigestConfig.tsx:91)
- "Digest settings saved." toast — matches UI-SPEC exactly (EmailDigestConfig.tsx:48)
- "Could not save digest settings. Check the recipient email and try again." — matches UI-SPEC exactly (EmailDigestConfig.tsx:53-54)
- "No call graph data" / secondary copy — matches plan spec (CallGraphPanel.tsx:49-51)
- "No deliveries yet" / secondary copy — matches plan spec (DeliveryHistory.tsx:21-27)
- "PagerDuty" section with "Send PagerDuty incident", routing key help text — all match spec (AlertRuleForm.tsx:414, 430, 449-451)

**WARNING — Recipient field lacks action affordance:**
- EmailDigestConfig.tsx:64-68: The "Recipient email" label renders a read-only explanatory paragraph ("Uses profile email address. Edit in Agent Profiles if different.") with no link or navigation affordance. Users who need to change the recipient have no path forward within the form. The label "Recipient email" implies an editable field but provides none.
- The `Input` component is imported (EmailDigestConfig.tsx:5) but never rendered in the final component. The plan called for an input field with placeholder "your@email.com"; the implementation replaced it with a static paragraph. This is a deviation from the UI-SPEC copywriting contract.
- Fix: Either render the imported Input for direct editing, or add a link/button: "Edit in Agent Profiles" that navigates to the profile section.

**Minor — "Cancel" is a generic label:**
- AlertRuleForm.tsx:525: `<Button variant="ghost">Cancel</Button>` inside the delete confirmation dialog. The spec calls this "Cancel" which is acceptable for a destructive confirmation dialog, but the rest of the form uses "Discard Changes" (line 497) for a similar ghost action. The inconsistency between the two ghost buttons could confuse users scanning the sheet.

---

### Pillar 2: Visuals (3/4)

**Passing:**
- CallGraphPanel: Clear visual hierarchy — SectionHeader + SVG graph + legend. Agent nodes (120x48) are visually larger than tool nodes (96x32) per spec.
- AlertRuleForm PagerDuty section: Collapsible with ChevronRight rotation and status summary ("On — ...xxxx" / "Off") gives good at-a-glance state.
- DeliveryHistory: Tabbed layout (Email / PagerDuty) with badge status coloring provides clear scan pattern.
- Loading skeleton in CallGraphPanel (h-[320px]) gives correct spatial reservation.

**WARNING — Legend dot uses #22c55e (green-500) but "Healthy" nodes are #141416 (agent) or #27272a (tool):**
- CallGraphPanel.tsx:10: `{ label: "Healthy", color: "#22c55e" }` — green dot in the legend.
- CallGraphSVG.tsx:133: Healthy agent node fill is `#141416` (near-black), healthy tool fill is `#27272a` (dark zinc).
- The legend dot color does not match the actual node color. A user seeing the green dot cannot map it back to any visible element in the graph. The graph has no green nodes — healthy nodes are dark-filled with a subtle border.
- Fix: Change the "Healthy" legend dot to `#27272a` (zinc-800, the healthy node stroke/fill) or use a border-only dot style (transparent fill, gray stroke) to match actual node appearance.

**WARNING — Empty state in DeliveryHistory is used for both loading and empty conditions:**
- DeliveryHistory.tsx:42-43: `!emailLogs || emailLogs.length === 0` — when `emailLogs` is `undefined` (loading), the empty state message "No deliveries yet" renders. A user who is waiting for data to load will see a message that implies the feature has never been used. This is a visual false-negative.

---

### Pillar 3: Color (3/4)

**Passing:**
- Badge status coloring is intentional and differentiated: green-500/400 for success, blue-500/400 for resolved, red-500/400 for failed (DeliveryHistory.tsx:61-65, 108-115).
- SVG node status colors follow the spec: #ef4444 for errored, #eab308 for pending border (CallGraphSVG.tsx:131-142).
- `bg-primary`/`text-primary` usage in Settings.tsx is limited to section headers and two button-like elements (lines 107, 180, 273, 314, 682, 699) — reasonable density.

**WARNING — Hardcoded hex colors throughout CallGraphSVG.tsx:**
- CallGraphSVG.tsx:131-144: All node and edge colors are hardcoded hex values (`#141416`, `#27272a`, `#ef4444`, `#eab308`, `#a1a1aa`, `#ffffff`). These bypass the Tailwind/CSS variable token system used everywhere else in the project (which uses `var(--primary)`, `text-muted-foreground`, etc.).
- If the design system theme ever changes, the SVG will not update. The SVG is also the only component in this phase with colors fully outside the token system.
- Fix: Define SVG color constants as CSS variables or map them to the project's design token names in a comment. Consider reading computed CSS variable values from the DOM at render time, or at minimum document the hex-to-token mapping.

**WARNING — Legend Healthy dot color (#22c55e, green-500) has no basis in the node color spec:**
- As noted in Visuals, `#22c55e` appears in the legend (CallGraphPanel.tsx:10) but nowhere in CallGraphSVG.tsx's node colors. This is a color introduced without a corresponding UI element. The accent budget effectively gains a fourth status color that doesn't exist in the visualization.

---

### Pillar 4: Typography (3/4)

**Font sizes in use across Phase 70 UI files:** text-xs, text-sm, text-base, text-lg, text-2xl — 5 distinct sizes.

**WARNING — 5 font sizes exceeds the 4-size guideline:**
- text-2xl appears in Infrastructure.tsx:76 (`<h1 className="text-2xl font-bold">Infrastructure</h1>`). This is a pre-existing page-level heading, not introduced by Phase 70. However, within the Phase 70 components themselves (EmailDigestConfig, DeliveryHistory, CallGraphPanel), only text-xs and text-sm are used — a tight, appropriate 2-size scale for data-dense panels.
- The text-2xl usage in Infrastructure.tsx inflates the count for this page context. The Phase 70 components themselves stay within a clean 2-3 size range.

**Font weights in use:** font-bold, font-medium, font-normal, font-semibold — 4 distinct weights. This is at the upper edge of the 2-weight guideline for components, but in a data-dense admin dashboard, 4 weights are defensible for clear hierarchy differentiation (table headers vs. values vs. labels vs. headings).

**Passing:**
- SVG text attributes use explicit numeric fontSize (12/10) and fontWeight (600/400) — correct for SVG elements which do not support Tailwind classes (CallGraphSVG.tsx:248-249).
- Font family fallback chain in SVG is appropriate: `'Geist Variable', 'Segoe UI', sans-serif` (CallGraphSVG.tsx:250).

---

### Pillar 5: Spacing (2/4)

**WARNING — Arbitrary width/height values across all Phase 70 components:**

Multiple arbitrary Tailwind values are present:
- `w-[200px]` — SelectTrigger width in EmailDigestConfig.tsx:75 and AlertRuleForm.tsx:465. Should use a standard width token (e.g., `w-48` = 192px, close enough) or at minimum `w-full` with a max-width.
- `w-[480px]` — SheetContent width in AlertRuleForm.tsx:266. This is a layout value for a slide-out panel and may be intentional for precise drawer sizing, but it bypasses the spacing scale.
- `h-[320px]` — Skeleton height in CallGraphPanel.tsx:25. Acceptable for a visual placeholder that must match the expected graph height.
- `max-w-[300px]` — TableCell truncation in DeliveryHistory.tsx:79, 131. Functional use for column width control, but not on the spacing scale.

**WARNING — Inconsistent section spacing in Settings.tsx (mt-8 vs mt-12):**
- Settings.tsx:723: EmailDigestConfig section uses `mt-8`.
- Settings.tsx:730: DeliveryHistory section uses `mt-12`.
- Settings.tsx:716 (Notification Channels): `mt-12`.
- Settings.tsx:735 (Notification Preferences): `mt-12`.
- EmailDigestConfig is the only section using `mt-8`, visually tighter than all other sections. This creates an inconsistent vertical rhythm — EmailDigestConfig appears more "attached" to Notification Channels than the others are to each other.
- Fix: Change EmailDigestConfig section wrapper to `mt-12` to match the other top-level section spacings.

**WARNING — Mixed spacing approaches in AlertRuleForm PagerDuty section:**
- The CollapsibleContent uses `p-3 space-y-3` (AlertRuleForm.tsx:422), while the outer form body uses `px-4 py-2` (line 294) and `gap-4` between form fields (line 295). The PagerDuty collapsible uses tighter padding than the surrounding form, making it visually compressed relative to sibling sections.

---

### Pillar 6: Experience Design (3/4)

**Passing:**
- CallGraphPanel.tsx: Full three-state coverage — loading (Skeleton), empty ("No call graph data"), populated (SVG + legend). Each state renders a complete GlassPanel with header, no layout shift.
- AlertRuleForm: Validation guard for empty PagerDuty routing key when PD is enabled (AlertRuleForm.tsx:189-193) — prevents silent misconfiguration. Toast errors for all failure paths.
- EmailDigestConfig: save state machine (`idle → saving → saved → idle`) with disabled button during save, spinner icon, and 2s auto-reset (EmailDigestConfig.tsx:31-49). Error toast on catch.
- SectionErrorBoundary wrapping on all new widgets (Infrastructure.tsx:97-99, Settings.tsx:722-733) prevents one panel from crashing the page.
- Delete confirmation dialog in AlertRuleForm prevents accidental rule deletion (AlertRuleForm.tsx:514-536).

**WARNING — DeliveryHistory has no loading state:**
- DeliveryHistory.tsx:42: `!emailLogs || emailLogs.length === 0` treats `undefined` (Convex loading state) the same as an empty array, immediately showing "No deliveries yet" before data arrives. On slow connections, this misleads the user into thinking no deliveries have occurred.
- Fix: Add a loading branch: `if (emailLogs === undefined || pagerdutyLogs === undefined) return <Skeleton className="h-32 w-full" />` before the tab render.

**WARNING — EmailDigestConfig has no loading state for config fetch:**
- EmailDigestConfig.tsx:26: `const config = useQuery(api.emailDigest.getEmailDigestConfigPublic)` — when `config` is `undefined` (loading), the form renders with default values (`enabled: false`, `schedule: "daily"`) from useState. A user who opens Settings before the query resolves sees false defaults and could immediately save incorrect values, overwriting their actual config.
- Fix: Add a guard: `if (config === undefined) return <Skeleton className="h-24 w-full" />` or disable the Save button while `config === undefined`.

**WARNING — PagerDuty section does not populate existing rule config on edit:**
- AlertRuleForm.tsx:148-159: The `useEffect` for custom mode edit (`customRuleId` present) has a comment "For custom mode + edit: would load customRule data here" but does NOT implement the load. When editing an existing custom rule that has PagerDuty configured, `pdEnabled`, `pdRoutingKey`, and `pdSeverity` all reset to defaults (`false`, `""`, `undefined`). The operator sees the PagerDuty section as "Off" even if it was previously configured. Saving without re-entering the routing key will clear the PagerDuty config for that rule.
- This is a BLOCKER-level UX regression for edit mode. New rule creation is unaffected.
- Fix: Query the existing custom rule (the form does not currently query it) and populate PD state on open when `customRuleId` is defined.

---

## Top Fixes

1. **BLOCKER — PagerDuty config not loaded on rule edit** (AlertRuleForm.tsx:148-159): When editing an existing custom rule, the PagerDuty section always shows "Off" with empty routing key regardless of saved config. Saving clears the existing PD config silently. Fix by querying the existing `alertRuleCustom` document by `customRuleId` in a `useQuery` and populating `pdEnabled`, `pdRoutingKey`, `pdSeverity` in the `useEffect` when `customRuleId` is defined.

2. **WARNING — DeliveryHistory and EmailDigestConfig missing loading states** (DeliveryHistory.tsx:42, EmailDigestConfig.tsx:26): Both components render final UI content (empty state copy or form defaults) while Convex queries are still loading. This causes false-negative empty states and potential config overwrites. Add `undefined` guards before the main render branches.

3. **WARNING — Call graph legend "Healthy" dot color (#22c55e green) does not match healthy node color** (CallGraphPanel.tsx:10, CallGraphSVG.tsx:133): Healthy nodes are dark (#141416/#27272a) but the legend dot is bright green. Fix the legend constant to use `#27272a` or match the actual node appearance with a border-only dot.

4. **WARNING — Settings.tsx section spacing inconsistency** (Settings.tsx:723 vs 716, 730, 735): EmailDigestConfig uses `mt-8` while all other top-level Settings sections use `mt-12`. Change to `mt-12` to restore consistent vertical rhythm.

5. **WARNING — Recipient email field removed without replacement affordance** (EmailDigestConfig.tsx:64-68): The plan called for an editable input; the implementation shows a static paragraph with no navigation path to change the email. Users cannot complete the "configure recipient" task from this form. Add either an editable Input or a linked navigation affordance.

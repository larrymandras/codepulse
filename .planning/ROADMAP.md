### Phase 79: Forge UI Tab (read-only render)
**Goal**: A `/forge` route + nav entry rendering jobs/status/detail from `useQuery(api.forge.*)`, porting StatusBadge/JobList/JobDetail ~1:1 from `forge/web/src`. View-only.
**Requirements**: FI-04 (forge page + route), FI-05 (component port)
**Depends on**: Phase 78
**Plans**: 3 plans across 3 waves
- [x] 79-01-PLAN.md — Foundation: useForge hook + ForgeJobRow adapter + ForgeStatusBadge (re-skin, SC#4) + ForgeHostBadge (FI-05) [wave 1]
- [ ] 79-02-PLAN.md — Composed components: ForgeMetadataPanel + ForgeJobList + ForgeJobDetail (port + strip action controls per D-01/D-02) (FI-05) [wave 2]
- [ ] 79-03-PLAN.md — ForgePage master-detail + /forge route (App.tsx) + CONSOLE nav entry with Flame icon (DashboardLayout.tsx) (FI-04) [wave 3]

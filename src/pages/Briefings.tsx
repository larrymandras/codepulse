import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────

type Profile = "personal" | "cto" | "consulting";
type BriefingTime = "morning" | "evening" | "weekly" | "weekend";

interface AgentRole {
  name: string;
  role: string;
}

interface BriefingSection {
  title: string;
  time: string;
  badge: BriefingTime;
  content: string[];
}

interface SourceCategory {
  title: string;
  sources: string[];
  frequency: string;
}

interface BriefingTemplate {
  id: string;
  title: string;
  badge: BriefingTime;
  time: string;
  deliveredBy: string;
  tone: string;
  template: string;
  sections: string[];
  philosophy: string[];
  dataSources: string[];
}

// ── Data ───────────────────────────────────────────────────────────

const AGENT_MAP: Record<Profile, AgentRole[]> = {
  personal: [
    { name: "Ástríðr", role: "Commander — assembles & delivers briefings" },
    { name: "Iðunn", role: "Family, health, home, personal calendar" },
    { name: "Urðr", role: "Research feeds, maker content, learning suggestions" },
  ],
  cto: [
    { name: "Ástríðr", role: "Commander — assembles & delivers briefings" },
    { name: "Hervor", role: "PRs, ADRs, GitHub digest, technical debt, AI intel" },
    { name: "Freya", role: "Meeting prep, Slack digest, board narratives, calendar" },
    { name: "Urðr", role: "AI/ML news, stack updates, industry monitoring" },
    { name: "Göndul", role: "CTO brand content calendar, publishing schedule" },
  ],
  consulting: [
    { name: "Ástríðr", role: "Commander — assembles & delivers briefings" },
    { name: "Brynhildr", role: "Client KBs, time tracking, engagements, invoices" },
    { name: "Ragnhildr", role: "Pipeline, proposals, outreach, win/loss" },
    { name: "Göndul", role: "Consulting brand content calendar" },
  ],
};

const SCHEDULE = [
  { time: "7:00 AM", label: "Morning Briefing", badge: "morning" as BriefingTime, profiles: "Personal + CTO + Consulting" },
  { time: "6:00 PM", label: "Evening Debrief", badge: "evening" as BriefingTime, profiles: "Personal + CTO + Consulting" },
  { time: "Sun 7:00 PM", label: "Weekly Synthesis", badge: "weekly" as BriefingTime, profiles: "All profiles — strategic review" },
  { time: "Sat/Sun 8:00 AM", label: "Weekend Variant", badge: "weekend" as BriefingTime, profiles: "Personal (hobby-focused) + alerts only" },
];

const BRIEFING_SECTIONS: Record<Profile, BriefingSection[]> = {
  personal: [
    {
      title: "Morning Brief",
      time: "7:00 AM daily",
      badge: "morning",
      content: [
        "Weather & Location — temperature, conditions, wind, severe alerts, pollen",
        "Today's Personal Calendar — events, conflicts, tomorrow preview",
        "People — birthdays, anniversaries, friend nudges",
        "Family — kids events, spouse calendar",
        "Health & Fitness — gym reminders, appointments, prescriptions",
        "Home — maintenance due, packages arriving, vendor appointments",
        "Personal Finance — bills due, subscription alerts",
        "Workshop & Maker — woodworking, laser, 3D printing, hunting updates",
        "Learning — reading progress, course progress, suggested articles",
      ],
    },
    {
      title: "Evening Brief",
      time: "6:00 PM daily",
      badge: "evening",
      content: [
        "Tomorrow Preview — first event, prep needed, weather outlook",
        "Unfinished Items — personal tasks still open, follow-ups",
        "Health Check-in — step count, sleep quality, workout status",
        "Evening Inspiration — one curated maker item to watch/read",
      ],
    },
  ],
  cto: [
    {
      title: "Morning Brief",
      time: "7:00 AM daily",
      badge: "morning",
      content: [
        "Calendar — today's meetings with prep notes and attendee context",
        "Slack Digest — priority threads, DMs needing response, noise filtered",
        "Team Pulse — who's blocked, PTO today, on-call status",
        "GitHub Digest — PRs needing review, issues needing input, CI/CD status",
        "AI & Model Intelligence — new releases, pricing changes, capability updates",
        "Stack Updates — framework releases, security advisories, dependency alerts",
        "Content & Brand — publishing schedule, performance highlights, lead attribution",
        "Top Priority Today — ranked action items from Freya",
      ],
    },
    {
      title: "Evening Brief",
      time: "6:00 PM daily",
      badge: "evening",
      content: [
        "Tomorrow Prep — meetings requiring preparation, materials needed",
        "Unresolved Items — Slack threads unanswered, PRs still pending",
        "Team Status — blockers surfaced, sprint health",
        "End-of-Day Commits — significant merges and deployments",
      ],
    },
  ],
  consulting: [
    {
      title: "Morning Brief",
      time: "7:00 AM daily",
      badge: "morning",
      content: [
        "Client Calendar — today's client meetings with prep notes",
        "Client Email Queue — needs response (>24h), new (last 24h), responded yesterday",
        "Active Engagements — status, deliverables, hours, invoice status per client",
        "Revenue Snapshot — MTD revenue, outstanding invoices, overdue alerts",
        "Pipeline — proposals pending, hottest leads, follow-ups due",
        "Consulting Brand Content — publishing today, performance highlights",
      ],
    },
    {
      title: "Evening Brief",
      time: "6:00 PM daily",
      badge: "evening",
      content: [
        "Time Tracking Confirmation — hours logged today per client",
        "Email Accountability — unanswered client emails",
        "Deliverable Deadlines — items due this week, overdue alerts",
        "Revenue Update — weekly on Fridays only",
      ],
    },
  ],
};

const SOURCE_CATEGORIES: SourceCategory[] = [
  { title: "Woodworking", sources: ["Jonathan Katz-Moses", "The Wood Whisperer", "Stumpy Nubs", "Blacktail Studio", "Matthias Wandel", "r/woodworking", "r/cuttingboards"], frequency: "Daily" },
  { title: "Laser Engraving", sources: ["Russ Sadler", "JT Makes It", "OMG Laser", "r/lasercutting", "xTool Blog", "Lightburn Forums"], frequency: "Daily" },
  { title: "3D Printing", sources: ["Makers Muse", "Teaching Tech", "CNC Kitchen", "Prusa Blog", "r/3Dprinting", "r/functionalprint"], frequency: "Daily" },
  { title: "Hunting & Firearms", sources: ["Georgia DNR", "Ducks Unlimited", "ATF.gov", "Weather.gov API", "r/waterfowlhunting"], frequency: "Seasonal" },
  { title: "AI / ML Ecosystem", sources: ["Anthropic Blog", "OpenAI Blog", "Google AI Blog", "Hacker News", "r/LocalLLaMA", "r/ClaudeAI", "HuggingFace Trending"], frequency: "2x Daily" },
  { title: "Claude Code / MCP", sources: ["Claude Code Changelog", "MCP Registry", "Anthropic Cookbook", "npm @anthropic-ai", "PyPI anthropic"], frequency: "Daily" },
  { title: "Stack: TS / React / Next.js", sources: ["Next.js Blog", "React Blog", "TypeScript Blog", "Vercel Blog", "npm Advisories"], frequency: "Daily" },
  { title: "Stack: Supabase / Convex / PG", sources: ["Supabase Blog", "Convex Blog", "PostgreSQL News", "pgvector Releases"], frequency: "Daily" },
  { title: "SOC2 & Compliance", sources: ["Vanta Blog", "Drata Blog", "AICPA SOC", "NIST Framework", "r/compliance"], frequency: "Weekly" },
  { title: "CTO / Engineering Leadership", sources: ["The Pragmatic Engineer", "StaffEng", "LeadDev", "InfoQ", "r/ExperiencedDevs"], frequency: "Weekly" },
];

const SOURCE_FLOW = [
  { time: "6:00 AM", action: "RSS/Atom ingestion complete" },
  { time: "6:15 AM", action: "Reddit top posts pulled" },
  { time: "6:30 AM", action: "YouTube new videos checked" },
  { time: "6:40 AM", action: "GitHub release checks" },
  { time: "6:45 AM", action: "Manufacturer page change detection" },
  { time: "6:50 AM", action: "Urðr filtering + ranking complete" },
  { time: "7:00 AM", action: "Ástríðr assembles morning briefing" },
  { time: "12:00 PM", action: "Midday RSS refresh (Tier 1 only)" },
  { time: "3:00 PM", action: "Deal alert check" },
  { time: "5:30 PM", action: "End-of-day RSS refresh" },
  { time: "6:00 PM", action: "Evening briefing assembly" },
];

// ── Briefing Templates (full content) ──────────────────────────────

const BRIEFING_TEMPLATES: Record<Profile, BriefingTemplate[]> = {
  personal: [
    {
      id: "personal-morning",
      title: "Personal — Morning Brief",
      badge: "morning",
      time: "7:00 AM daily",
      deliveredBy: "Ástríðr (assembled from Iðunn + Urðr feeds)",
      tone: "Warm, concise, starts-your-day energy",
      template: `═══ PERSONAL ═══════════════════════════════

☀️ WEATHER — Atlanta, GA
──────────────────────────────────
• {current_temp}°F, {conditions} → {high}/{low}°F today
• {weather_advisory — rain/umbrella, severe weather, or omit if clear}
• Wind: {speed} mph {direction}
• Weekend outlook: {fri_sat_sun_summary — only on Thursday/Friday}

📅 TODAY'S PERSONAL CALENDAR
──────────────────────────────────
• {time} — {event} {location if applicable}
• {conflict_alert if any: "⚠️ Overlaps with CTO standup at 10am"}
• Tomorrow first: {first_event_tomorrow}

🎂 PEOPLE
──────────────────────────────────
• {birthday/anniversary today or this week — with gift status from Iðunn}
• {friend_nudge if applicable}

👨‍👩‍👧‍👦 FAMILY
──────────────────────────────────
• {kids_events_today: school, activities, pickup times}
• {spouse_calendar_notable if shared}

🏥 HEALTH & FITNESS
──────────────────────────────────
• {gym_reminder based on pattern}
• {upcoming_appointment if within 3 days}
• {prescription_reminder if due}

🏠 HOME
──────────────────────────────────
• {maintenance_due}
• {package_arriving: "📦 {carrier}: {item} arriving today"}
• {vendor_appointment if scheduled}

💰 PERSONAL FINANCE
──────────────────────────────────
• {bills_due_this_week}
• {subscription_alert: "{service} renewing in {n} days — $X/mo"}

🔨 WORKSHOP & MAKER
──────────────────────────────────
  🪵 Woodworking
  • {new_technique_video if noteworthy}
  • {community_highlight from r/woodworking}

  🔴 Laser (CO2 + MOPA)
  • {manufacturer_news}
  • {deal_alert}

  🖨️ 3D Printing
  • {manufacturer_news}
  • {community_project if inspiring}

🦆 HUNTING & FIREARMS
──────────────────────────────────
  🎯 Season & Regulations
  • {active_seasons}
  • {regulation_change if any}

  🌤️ Hunting Conditions {only during active season}
  • Wind, temperature, precipitation, moon phase, sunrise/sunset

  📋 FFL/SOT
  • {atf_regulatory_update if any}

📚 LEARNING
──────────────────────────────────
• {reading_progress}
• {course_progress}
• {suggested_resource from Urðr}`,
      sections: [
        "Weather & Location",
        "Today's Personal Calendar",
        "People (birthdays, anniversaries)",
        "Family",
        "Health & Fitness",
        "Home",
        "Personal Finance",
        "Workshop & Maker (Woodworking, Laser, 3D Printing)",
        "Hunting & Firearms",
        "Learning",
      ],
      philosophy: [
        "Always show: Weather, Calendar, Workshop/Maker",
        "Show if noteworthy: People, Family, Health, Home, Finance, Hunting, Learning",
        "Omit entirely if empty: People, Home, Finance, Learning",
        "Hunting conditions only during active season or within 7 days of opener",
        "Deal alerts: Max 1 per category per day",
      ],
      dataSources: [
        "Weather API (Atlanta, GA)",
        "Google Calendar (Personal)",
        "Iðunn's memory files (People, Family, Health, Home, Finance)",
        "Urðr monitoring feeds (YouTube, Reddit, manufacturer RSS, deal aggregators)",
        "State wildlife agency, ATF, weather service (Hunting)",
      ],
    },
    {
      id: "personal-evening",
      title: "Personal — Evening Brief",
      badge: "evening",
      time: "6:00 PM daily",
      deliveredBy: "Ástríðr (assembled from Iðunn)",
      tone: "Reflective, wind-down, forward-looking",
      template: `═══ PERSONAL — EVENING ════════════════════

📋 TODAY'S RECAP
──────────────────────────────────
• Personal calendar items completed: {count}
  {list any that were missed or rescheduled}
• {gym_status: "✅ Workout logged" or "Skipped — {n} days since last session"}

📦 DELIVERIES & HOME
──────────────────────────────────
• {packages_delivered_today}
• {home_task_completed or still_pending}

🔨 WORKSHOP EVENING PICK {only 1 item}
──────────────────────────────────
• {curated_single_item: a maker YouTube video or technique article}
  "{title}" by {creator} — {duration/length} — {why it's relevant}

📅 TOMORROW PREVIEW
──────────────────────────────────
• {first_event}: {time}
• {total_events}: {count} across personal calendar
• {prep_needed}: "{event} requires {action}"}
• {weather_tomorrow_brief}: {high}/{low}°F, {conditions}

🔔 REMINDERS
──────────────────────────────────
• {bills_due_tomorrow}
• {birthday_tomorrow}
• {kids_tomorrow: early pickup, special event}`,
      sections: [
        "Today's Recap",
        "Deliveries & Home",
        "Workshop Evening Pick (1 curated item)",
        "Tomorrow Preview",
        "Reminders",
      ],
      philosophy: [
        "Short — this is wind-down, not information overload",
        "One curated maker item — quality over quantity",
        "Forward-looking — set up tomorrow so you can relax tonight",
        "No news, no markets, no hunting stats — evening is personal time",
      ],
      dataSources: [
        "Google Calendar (Personal)",
        "Iðunn's daily tracking",
        "Urðr's curated pick",
      ],
    },
    {
      id: "personal-weekend",
      title: "Personal — Weekend Morning",
      badge: "weekend",
      time: "8:00 AM Sat/Sun",
      deliveredBy: "Ástríðr (assembled from Iðunn + Urðr)",
      tone: "Relaxed, hobby-focused, no work pressure",
      template: `═══ WEEKEND PERSONAL ═══════════════════════
Good morning, Commander. {day_of_week}, {date}.

☀️ WEATHER — Atlanta, GA
──────────────────────────────────
• {current_temp}°F, {conditions} → {high}/{low}°F today
• {outdoor_assessment: "Great day for the workshop" / "Good hunting weather" / "Indoor project day"}

📅 WEEKEND CALENDAR
──────────────────────────────────
• {events}
• {unscheduled_blocks: "{hours}h of free time today"}

🦆 HUNTING CONDITIONS {only during active season}
──────────────────────────────────
• Season: {game_type} — {days_remaining} days remaining
• Wind, Temperature, Moon, Sunrise/Sunset
• {public_land_report if available}

🔨 WORKSHOP & MAKER — WEEKEND EDITION
──────────────────────────────────
  📌 Active Projects
  • {project_1}: {status}
  • {project_2}: {status}

  💡 Weekend Inspiration {Urðr's top 3 picks}
  • 🪵 "{title}" by {creator}
  • 🔴 "{title}" by {creator}
  • 🖨️ "{title}" by {creator}

  🏷️ Deals Active This Weekend (max 3)
  • {deal_1}
  • {deal_2}

  🛠️ Workshop Tip of the Weekend
  • {curated_single_tip}

  📋 Maker Community Highlights
  • r/woodworking, r/3Dprinting, r/lasercutting (1 best post each)

👨‍👩‍👧‍👦 FAMILY WEEKEND
──────────────────────────────────
• {kids_activities}, {family_plan}

🏠 HOME & ERRANDS
──────────────────────────────────
• {maintenance_due}, {errands}, {packages}

📚 WEEKEND READING/LEARNING
──────────────────────────────────
• {current_book}, {course}

═══ WORK ALERTS ONLY ═══════════════════════
• CTO: {alert_count} alerts │ "✅ All clear" or critical only
• Consulting: {overdue_emails} │ "✅ All clear" or overdue only`,
      sections: [
        "Weather (outdoor assessment)",
        "Weekend Calendar",
        "Hunting Conditions (seasonal)",
        "Workshop & Maker — Weekend Edition (projects, inspiration, deals, tips, community)",
        "Family Weekend",
        "Home & Errands",
        "Weekend Reading/Learning",
        "Work Alerts Only (CTO + Consulting compressed)",
      ],
      philosophy: [
        "Hobby-first — workshop section LEADS on weekends",
        "Expanded inspiration: Urðr's top 3 picks (one per discipline)",
        "Deals section expanded: up to 3 (vs 1 on weekdays)",
        "Hunting conditions lead during active season",
        "Work compresses to ONE section — just alerts",
        "Delivery 1 hour later (8 AM, not 7 AM)",
      ],
      dataSources: [
        "Weather API",
        "Google Calendar (Personal)",
        "Iðunn's project tracking + Urðr's weekend picks",
        "Deal aggregators (>15% off or price-history low)",
      ],
    },
  ],
  cto: [
    {
      id: "cto-morning",
      title: "Business (CTO) — Morning Brief",
      badge: "morning",
      time: "7:00 AM daily",
      deliveredBy: "Ástríðr (assembled from Hervor + Freya + Urðr feeds)",
      tone: "Crisp, executive, signal-dense",
      template: `═══ BUSINESS (CTO) ════════════════════════

📅 TODAY'S CTO CALENDAR
──────────────────────────────────
• {time} — {meeting} [{type: 1:1/standup/board/external}]
  {prep_status: "📋 Prep packet ready" or "⚠️ Prep needed"}
• Meetings today: {count} │ Focus blocks: {count} │ Free: {hours}h

👥 TEAM PULSE
──────────────────────────────────
• Active team members: {count}/{total}
• {notable_absence}, {blocker_alert}, {morale_signal}

🔀 GITHUB DIGEST {from Hervor}
──────────────────────────────────
  🔴 Needs Your Review
  • PR #{number}: {title} by {author} — {age}
    {3_sentence_summary} │ Impact: {files_changed} files

  🟡 FYI (Merged Since Yesterday)
  • PR #{number}: {title} ✅

  🔵 Stale/Blocked
  • PR #{number}: {title} — open {days} days

  📋 Issues Needing Your Input {max 3}
  🐛 Critical Bugs (open count)
  Pipeline: {ci_status} │ Deploys (24h): {count}

🛡️ SOC2 & COMPLIANCE
──────────────────────────────────
• Compliance posture: {status}
• {control_alert}, {audit_countdown}, {vendor_security_alert}

💰 BUDGET & INFRASTRUCTURE
──────────────────────────────────
• Cloud spend (MTD): $\{amount} │ Projected: $\{projected} │ Budget: $\{budget}
• {spike_alert}, {license_renewal}

🤖 AI & MODEL INTELLIGENCE {from Hervor + Urðr}
──────────────────────────────────
  📢 Breaking (last 24h)
  🧠 New Models & Releases
  🔌 Claude Code / MCP / Skills / Hooks Ecosystem
  🔬 Techniques & Frameworks
  🏢 AI Ecosystem Tracker (Anthropic, OpenAI, Google, Meta, Open Source, HuggingFace, Startups)
  🏗️ Stack-Relevant Updates (TS/React/Next.js, Python, Supabase, Convex, PostgreSQL)

📊 METRICS SNAPSHOT {if dashboards integrated}
⚒️ ÁSTRÍÐR FRAMEWORK BUILD {from CodePulse}
📣 CONTENT & BRAND {from Göndul}
🔥 TOP PRIORITY TODAY {from Freya}`,
      sections: [
        "Today's CTO Calendar (with prep status)",
        "Team Pulse (blockers, PTO, morale)",
        "GitHub Digest (PRs needing review, merged, stale, issues, bugs, CI/CD)",
        "SOC2 & Compliance",
        "Budget & Infrastructure",
        "AI & Model Intelligence (breaking, models, Claude Code ecosystem, techniques, tracker, stack)",
        "Metrics Snapshot",
        "Ástríðr Framework Build",
        "Content & Brand (from Göndul)",
        "Top Priority Today (from Freya)",
      ],
      philosophy: [
        "Always show: Calendar, GitHub Digest, AI Intelligence, Top Priority",
        "Show if noteworthy: Team Pulse, SOC2, Budget, Metrics, Content",
        "AI depth: Breaking news always shows; ecosystem tracker only with actual news",
        "GitHub digest: Max 3 PRs in 'Needs Review', max 3 Issues",
        "SOC2 scales: expands during audit prep, compresses during maintenance",
      ],
      dataSources: [
        "Google Calendar (Business) + Freya's prep tracker",
        "Slack activity + GitHub contributor activity (Hervor + Freya)",
        "GitHub API via Hervor (PRs, Issues, Actions, Commits)",
        "Compliance platform (Freya)",
        "Cloud provider billing APIs + Freya's license tracker",
        "Urðr monitoring (Anthropic, OpenAI, Google AI, HuggingFace, arXiv, HN, Reddit, MCP registry)",
        "CodePulse dashboard API",
        "Göndul's content calendar + platform analytics",
      ],
    },
    {
      id: "cto-evening",
      title: "Business (CTO) — Evening Brief",
      badge: "evening",
      time: "6:00 PM daily",
      deliveredBy: "Ástríðr (assembled from Hervor + Freya)",
      tone: "Wrap-up, accountability, forward-looking",
      template: `═══ BUSINESS (CTO) — EVENING ══════════════

📋 TODAY'S EXECUTION
──────────────────────────────────
• Meetings completed: {count}/{planned}
• Action items generated today: {count}
  {list top 3 with owner and deadline}
• PRs reviewed: {count} │ Approved: {count} │ Requested changes: {count}

🔀 END-OF-DAY GITHUB
──────────────────────────────────
• PRs merged today: {count}
• Your review queue: {remaining_count}
• CI/CD status: {all_green ✅ or details}
• Deploy status: {any deploys, incidents}

🛡️ SOC2 STATUS
──────────────────────────────────
• {changes since morning only}

💰 SPEND UPDATE
──────────────────────────────────
• Today's cloud spend: $\{amount} {vs daily average}
• MTD total: $\{amount} / $\{budget} ({percent}%)

👥 TEAM END-OF-DAY
──────────────────────────────────
• {blocked_items_still_open}
• {notable_accomplishment}
• {1:1_followup if applicable}

📅 TOMORROW'S CTO CALENDAR
──────────────────────────────────
• {first_meeting}: {time} [{type}] + {prep_status}
• Total meetings: {count}

🔥 OPEN ITEMS CARRIED FORWARD
──────────────────────────────────
• {item_1}: {status} — {days_open}
• {item_2}: {status}
→ {count} total items in your CTO action backlog`,
      sections: [
        "Today's Execution (meetings, action items, PRs)",
        "End-of-Day GitHub (merges, queue, CI/CD, deploys)",
        "SOC2 Status (changes only)",
        "Spend Update",
        "Team End-of-Day (blockers, accomplishments, 1:1 follow-ups)",
        "Tomorrow's CTO Calendar",
        "Open Items Carried Forward",
      ],
      philosophy: [
        "Accountability — what got done, what didn't, what carries forward",
        "No AI news — morning is for info intake, evening is for execution review",
        "Prep tomorrow — surface anything needed for tomorrow's meetings",
        "SOC2 compressed — only show if something changed since morning",
      ],
      dataSources: [
        "Google Calendar (Business)",
        "GitHub API via Hervor",
        "Freya's action item tracker",
        "Cloud billing APIs",
      ],
    },
    {
      id: "cto-weekly",
      title: "Sunday Weekly Synthesis",
      badge: "weekly",
      time: "Sunday 7:00 PM",
      deliveredBy: "Ástríðr (assembled from ALL agents)",
      tone: "Strategic, reflective, forward-planning",
      template: `═══ WEEKLY SYNTHESIS ═══════════════════════
Sunday, {date} │ Week {week_number}

📊 WEEK IN NUMBERS
──────────────────────────────────
  CTO:        {meetings} meetings │ {prs_reviewed} PRs │ {issues_closed} issues closed
  Consulting: {billable}h billable │ $\{revenue} earned │ {client_meetings} meetings
  Personal:   {events} events │ {gym_sessions} gym sessions │ {workshops} workshop hours
  Content:    {pieces_published} published │ {total_views} views │ {leads} leads
  Framework:  {components_completed} components │ v{version} │ {patches} auto-patches

═══ CTO WEEKLY ═════════════════════════════
  👥 Team Health (velocity, PR cycle time, per-report pulse)
  🔀 GitHub Weekly (opened, merged, closed, backlog, notable merges)
  🛡️ SOC2 Weekly
  💰 Budget Weekly (cloud spend, licenses renewing)
  🤖 AI Weekly Digest (top 3 developments, Claude Code ecosystem)
  ⚒️ Ástríðr Build Weekly

═══ CONSULTING WEEKLY ══════════════════════
  💸 Revenue & Time (hours, revenue, MTD, outstanding, utilization)
  📄 Engagements Status (per-client with contract countdown)
  📬 Pipeline Status (proposals, leads, pipeline health)

═══ PERSONAL WEEKLY ════════════════════════
  🏥 Health & Fitness
  🔨 Workshop Recap
  👨‍👩‍👧‍👦 Family & Social

═══ CONTENT REVIEW ═════════════════════════
  📣 This Week's Performance (CTO brand + Consulting brand)
  📋 Next Week's Queue — APPROVE/EDIT (Mon-Fri content for ✅/✏️)

═══ CROSS-PROFILE ══════════════════════════
  💰 Financial Snapshot (monthly — 1st Sunday only)
  📅 Next Week Preview (per-day meeting counts, heaviest day)
  🎯 Ástríðr's Recommendations (pattern insights, priority suggestions)`,
      sections: [
        "Week in Numbers (cross-profile summary)",
        "CTO Weekly (team health, GitHub, SOC2, budget, AI digest, build)",
        "Consulting Weekly (revenue, engagements, pipeline)",
        "Personal Weekly (health, workshop, family)",
        "Content Review (performance + next week's approval queue)",
        "Cross-Profile (financial snapshot, next week preview, Ástríðr's recommendations)",
      ],
      philosophy: [
        "Zoom out — daily briefings are tactical, Sunday is strategic",
        "Numbers first — 'Week in Numbers' gives the pulse in 5 seconds",
        "Per-report pulse — notice who's thriving, struggling, or quiet",
        "Content review is a WORKFLOW — approve next week's content here",
        "Ástríðr's recommendations — cross-profile intelligence and pattern detection",
        "Financial snapshot monthly only — weekly would be noise at current scale",
      ],
      dataSources: [
        "All agent feeds aggregated",
        "GitHub API weekly summaries (Hervor)",
        "Göndul's content calendar + platform analytics",
        "Brynhildr's time tracking + invoice tracker",
        "Ragnhildr's CRM pipeline",
        "CodePulse build progress API",
      ],
    },
  ],
  consulting: [
    {
      id: "consulting-morning",
      title: "Consulting — Morning Brief",
      badge: "morning",
      time: "7:00 AM daily",
      deliveredBy: "Ástríðr (assembled from Brynhildr + Ragnhildr)",
      tone: "Client-focused, revenue-aware, concise",
      template: `═══ CONSULTING ════════════════════════════

📅 CLIENT CALENDAR TODAY
──────────────────────────────────
• {time} — {client_name}: {meeting_type} {location/link}
  {prep_note from Brynhildr if applicable}
• No client meetings today {if empty}

📧 CLIENT EMAIL QUEUE {from Brynhildr}
──────────────────────────────────
  🔴 Needs Response (>24h old)
  • {client}: "{subject}" — received {time_ago}

  🟡 New (Last 24h)
  • {client}: "{subject}" — received {time_ago}

  ✅ Responded Yesterday
  • {client}: "{subject}" — replied {time}

  Inbox: {unread_count} unread │ {overdue_count} awaiting response >24h

📄 ACTIVE ENGAGEMENTS {from Brynhildr}
──────────────────────────────────
• {client}: {status} │ {current_deliverable} │ Due: {date}
  {hours_this_week}/{hours_budgeted} hours │ Invoice: {status}
→ {total_active_clients} active │ {total_hours_this_week} hours this week

💸 REVENUE SNAPSHOT
──────────────────────────────────
• MTD revenue: $\{amount} │ Outstanding invoices: $\{amount}
• {overdue_alert if any}

📬 PIPELINE {from Ragnhildr}
──────────────────────────────────
• Proposals pending: {count} — $\{total_potential_value}
  {hottest_lead}
• {follow_up_due}

📣 CONSULTING BRAND CONTENT {from Göndul}
──────────────────────────────────
• Publishing today: {platform}: "{title}" — {status}
• {performance_highlight}
• {content_lead: "🎯 Inbound from '{piece}' — Ragnhildr tracking"}`,
      sections: [
        "Client Calendar Today",
        "Client Email Queue (overdue, new, responded)",
        "Active Engagements (per-client with hours + invoice)",
        "Revenue Snapshot",
        "Pipeline (proposals, leads, follow-ups)",
        "Consulting Brand Content (from Göndul)",
      ],
      philosophy: [
        "Always show: Client Calendar (even if empty), Email Queue",
        "Show if active clients exist: Active Engagements, Revenue",
        "Show if pipeline exists: Pipeline section",
        "Intentionally lightweight until consulting business ramps up",
      ],
      dataSources: [
        "Google Calendar (Consulting profile)",
        "Gmail (Brynhildr's triage — consulting-tagged emails)",
        "Brynhildr's per-client tracking (Obsidian + Google Sheets)",
        "Ragnhildr's CRM (Google Sheets)",
        "Göndul's consulting brand calendar",
      ],
    },
    {
      id: "consulting-evening",
      title: "Consulting — Evening Brief",
      badge: "evening",
      time: "6:00 PM daily",
      deliveredBy: "Ástríðr (assembled from Brynhildr)",
      tone: "Accountability, time tracking, forward-prep",
      template: `═══ CONSULTING — EVENING ══════════════════

⏱️ TIME TRACKING CONFIRMATION
──────────────────────────────────
  Today's hours by client:
  • {client_1}: {hours}h — {activity_summary}
  • {client_2}: {hours}h — {activity_summary}
  • Unbilled: {hours}h — {description}
  ─────
  Total: {total}h │ Billable: {billable}h │ Utilization: {percent}%

  Does this look right? Reply ✅ to confirm or correct any entries.

📧 EMAIL STATUS
──────────────────────────────────
• Responded today: {count}
• Still needs response: {count}
  {oldest_unanswered}
• Emails sent on your behalf: {count}

📄 DELIVERABLE PROGRESS
──────────────────────────────────
• {client}: {deliverable} — {percent}% complete │ Due: {date}
  {status_assessment: "On track ✅" or "⚠️ Behind"}

📅 TOMORROW'S CONSULTING CALENDAR
──────────────────────────────────
• {time} — {client}: {meeting_type}
  {prep_needed}
• No client meetings tomorrow {if empty}

💸 WEEKLY REVENUE UPDATE {Friday only}
──────────────────────────────────
• Hours this week: {total}h billable │ $\{revenue} earned
• MTD: $\{mtd_revenue} / $\{mtd_target} ({percent}%)
• Outstanding invoices: {count} totaling $\{amount}`,
      sections: [
        "Time Tracking Confirmation (per-client hours)",
        "Email Status (responded, outstanding, sent on your behalf)",
        "Deliverable Progress (per-client with deadline)",
        "Tomorrow's Consulting Calendar",
        "Weekly Revenue Update (Friday only)",
      ],
      philosophy: [
        "Time tracking is the #1 job — confirm every evening",
        "Email accountability — surface anything still unanswered",
        "Deliverable deadlines — early warning, never miss a client deadline",
        "Revenue update only on Fridays — daily tracking is noise, weekly is signal",
      ],
      dataSources: [
        "Brynhildr's passive time tracking",
        "Gmail (Consulting-tagged)",
        "Brynhildr's deliverable tracker",
        "Brynhildr's invoice tracker",
      ],
    },
  ],
};

// ── Download helper ───────────────────────────────────────────────

function downloadTemplate(template: BriefingTemplate) {
  const content = [
    `# ${template.title}`,
    "",
    `**Delivered by:** ${template.deliveredBy}`,
    `**Time:** ${template.time}`,
    `**Tone:** ${template.tone}`,
    "",
    "---",
    "",
    "## Template",
    "",
    "```",
    template.template,
    "```",
    "",
    "---",
    "",
    "## Sections",
    ...template.sections.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## Philosophy",
    ...template.philosophy.map((p) => `- ${p}`),
    "",
    "## Data Sources",
    ...template.dataSources.map((d) => `- ${d}`),
    "",
  ].join("\n");

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${template.id}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadAllTemplates(profile: Profile) {
  const templates = BRIEFING_TEMPLATES[profile];
  const profileLabel = profile === "cto" ? "CTO / Business" : profile.charAt(0).toUpperCase() + profile.slice(1);
  const content = [
    `# ${profileLabel} Briefing Templates`,
    "",
    `> Exported from CodePulse Briefing Dashboard`,
    "",
    "---",
    "",
    ...templates.flatMap((t) => [
      `## ${t.title}`,
      "",
      `**Delivered by:** ${t.deliveredBy}`,
      `**Time:** ${t.time}`,
      `**Tone:** ${t.tone}`,
      "",
      "### Template",
      "",
      "```",
      t.template,
      "```",
      "",
      "### Sections",
      ...t.sections.map((s, i) => `${i + 1}. ${s}`),
      "",
      "### Philosophy",
      ...t.philosophy.map((p) => `- ${p}`),
      "",
      "### Data Sources",
      ...t.dataSources.map((d) => `- ${d}`),
      "",
      "---",
      "",
    ]),
  ].join("\n");

  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `briefing-templates-${profile}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Badge Component ────────────────────────────────────────────────

const badgeColors: Record<BriefingTime, string> = {
  morning: "bg-emerald-900/50 text-emerald-400 border-emerald-700/50",
  evening: "bg-amber-900/50 text-amber-400 border-amber-700/50",
  weekly: "bg-purple-900/50 text-purple-400 border-purple-700/50",
  weekend: "bg-sky-900/50 text-sky-400 border-sky-700/50",
};

function Badge({ type }: { type: BriefingTime }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${badgeColors[type]}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-100">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ── Profile Tab Button ─────────────────────────────────────────────

function ProfileTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-indigo-600 text-white"
          : "bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-800 border border-gray-700/50"
      }`}
    >
      {label}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export default function Briefings() {
  const [activeTab, setActiveTab] = useState<"overview" | "templates" | "sources">("overview");
  const [activeProfile, setActiveProfile] = useState<Profile>("personal");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Briefings</h1>
        <div className="flex gap-2">
          {(["overview", "templates", "sources"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === "overview" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Daily Briefings" value={2} sub="Morning + Evening" />
            <StatCard label="Profiles" value={3} sub="Personal · CTO · Consulting" />
            <StatCard label="Active Agents" value={10} sub="The Valkyrjur" />
            <StatCard label="Source Categories" value={SOURCE_CATEGORIES.length} sub="150+ feeds monitored" />
          </div>

          {/* Schedule */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Briefing Schedule</h2>
            <div className="space-y-3">
              {SCHEDULE.map((s) => (
                <div key={s.time} className="flex items-center gap-4">
                  <span className="text-xs font-mono text-indigo-400 w-28 flex-shrink-0">{s.time}</span>
                  <Badge type={s.badge} />
                  <span className="text-sm text-gray-200">{s.label}</span>
                  <span className="text-xs text-gray-500 ml-auto">{s.profiles}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Assignments */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Agent Assignments by Profile</h2>
            <div className="flex gap-2 mb-4">
              <ProfileTab label="Personal" active={activeProfile === "personal"} onClick={() => setActiveProfile("personal")} />
              <ProfileTab label="CTO / Business" active={activeProfile === "cto"} onClick={() => setActiveProfile("cto")} />
              <ProfileTab label="Consulting" active={activeProfile === "consulting"} onClick={() => setActiveProfile("consulting")} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Agent</th>
                    <th className="text-left py-2 px-3 text-xs text-gray-500 font-medium">Briefing Role</th>
                  </tr>
                </thead>
                <tbody>
                  {AGENT_MAP[activeProfile].map((a) => (
                    <tr key={a.name} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 px-3 text-gray-200 font-medium">{a.name}</td>
                      <td className="py-2 px-3 text-gray-400">{a.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Source Flow */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily Source Flow</h2>
            <div className="space-y-2">
              {SOURCE_FLOW.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xs font-mono text-indigo-400 w-20 flex-shrink-0 pt-0.5">{s.time}</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      s.time === "7:00 AM" || s.time === "6:00 PM" ? "bg-indigo-500" : "bg-gray-600"
                    }`} />
                    <span className={`text-sm ${
                      s.time === "7:00 AM" || s.time === "6:00 PM" ? "text-gray-200 font-medium" : "text-gray-400"
                    }`}>{s.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Channels */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              { profile: "Personal", channel: "Telegram", icon: "💬" },
              { profile: "CTO / Business", channel: "Slack", icon: "📡" },
              { profile: "Consulting", channel: "Telegram", icon: "💬" },
            ] as const).map((d) => (
              <div key={d.profile} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 flex items-center gap-3">
                <span className="text-lg">{d.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-200">{d.profile}</p>
                  <p className="text-xs text-gray-500">via {d.channel}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══ TEMPLATES TAB ═══ */}
      {activeTab === "templates" && (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              <ProfileTab label="Personal" active={activeProfile === "personal"} onClick={() => setActiveProfile("personal")} />
              <ProfileTab label="CTO / Business" active={activeProfile === "cto"} onClick={() => setActiveProfile("cto")} />
              <ProfileTab label="Consulting" active={activeProfile === "consulting"} onClick={() => setActiveProfile("consulting")} />
            </div>
            <button
              onClick={() => downloadAllTemplates(activeProfile)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-600/30 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download All
            </button>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            {BRIEFING_TEMPLATES[activeProfile].length} briefing template{BRIEFING_TEMPLATES[activeProfile].length !== 1 ? "s" : ""} for this profile. Expand to view full template, download individually or all at once.
          </p>

          {BRIEFING_TEMPLATES[activeProfile].map((tmpl) => (
            <details key={tmpl.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl group">
              <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-800/80 rounded-xl transition-colors">
                <Badge type={tmpl.badge} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-gray-200">{tmpl.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{tmpl.deliveredBy}</p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">{tmpl.time}</span>
                <button
                  onClick={(e) => { e.preventDefault(); downloadTemplate(tmpl); }}
                  title="Download this template"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-400 hover:bg-gray-700/50 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <span className="text-gray-600 group-open:rotate-90 transition-transform text-xs flex-shrink-0">▶</span>
              </summary>

              <div className="px-5 pb-5 border-t border-gray-700/30 space-y-4">
                {/* Tone */}
                <div className="pt-4">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Tone</span>
                  <p className="text-sm text-gray-400 mt-1">{tmpl.tone}</p>
                </div>

                {/* Sections overview */}
                <div>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Sections</span>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tmpl.sections.map((s) => (
                      <span key={s} className="text-[11px] bg-gray-900/60 text-gray-400 px-2 py-1 rounded border border-gray-700/30">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Full template */}
                <div>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Template Preview</span>
                  <pre className="mt-2 p-4 bg-gray-950/80 border border-gray-700/30 rounded-lg text-xs text-gray-400 font-mono overflow-x-auto max-h-96 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                    {tmpl.template}
                  </pre>
                </div>

                {/* Philosophy */}
                <div>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Philosophy & Rules</span>
                  <ul className="mt-2 space-y-1">
                    {tmpl.philosophy.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <span className="text-gray-600 mt-0.5">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Data Sources */}
                <div>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Data Sources</span>
                  <ul className="mt-2 space-y-1">
                    {tmpl.dataSources.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <span className="text-indigo-500/60 mt-0.5">→</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          ))}
        </>
      )}

      {/* ═══ SOURCES TAB ═══ */}
      {activeTab === "sources" && (
        <>
          <p className="text-sm text-gray-500">
            {SOURCE_CATEGORIES.length} categories with 150+ sources monitored daily by Urðr for briefing content.
          </p>

          <div className="space-y-3">
            {SOURCE_CATEGORIES.map((cat) => (
              <details key={cat.title} className="bg-gray-800/50 border border-gray-700/50 rounded-xl group">
                <summary className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-800/80 rounded-xl transition-colors">
                  <span className="text-sm font-medium text-gray-200">{cat.title}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{cat.sources.length} sources</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                      cat.frequency === "2x Daily" ? "bg-indigo-900/50 text-indigo-400" :
                      cat.frequency === "Daily" ? "bg-emerald-900/50 text-emerald-400" :
                      cat.frequency === "Weekly" ? "bg-purple-900/50 text-purple-400" :
                      "bg-amber-900/50 text-amber-400"
                    }`}>{cat.frequency}</span>
                    <span className="text-gray-600 group-open:rotate-90 transition-transform text-xs">▶</span>
                  </div>
                </summary>
                <div className="px-5 pb-4 pt-1 border-t border-gray-700/30">
                  <div className="flex flex-wrap gap-2">
                    {cat.sources.map((src) => (
                      <span key={src} className="text-xs bg-gray-900/50 text-gray-400 px-2.5 py-1 rounded-lg border border-gray-700/30">
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

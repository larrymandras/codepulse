import { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import AlertBanner from "../components/AlertBanner";
import ErrorBoundary from "../components/ErrorBoundary";
import OnboardingGuide from "../components/OnboardingGuide";
import UserMenu from "../components/UserMenu";
import PrivacyShield from "../components/PrivacyShield";
import AmbientAudioPlayer from "../components/AmbientAudioPlayer";
import { useAudioEvents } from "../hooks/useAudioEvents";

const navItems = [
  { to: "/", label: "Dashboard", icon: "grid" },
  { to: "/capabilities", label: "Capabilities", icon: "cpu" },
  { to: "/analytics", label: "Analytics", icon: "chart" },
  { to: "/alerts", label: "Alerts", icon: "bell" },
  { to: "/infrastructure", label: "Infrastructure", icon: "server" },
  { to: "/agents", label: "Agents", icon: "bot" },
  { to: "/profiles", label: "Profiles", icon: "users" },
  { to: "/security", label: "Security", icon: "shield" },
  { to: "/self-healing", label: "Self-Healing", icon: "refresh" },
  { to: "/build", label: "Build", icon: "hammer" },
  { to: "/forge", label: "Forge", icon: "tree" },
  { to: "/memory", label: "Memory", icon: "brain" },
  { to: "/settings", label: "Settings", icon: "gear" },
];

const iconMap: Record<string, string> = {
  grid: "|||",
  cpu: "[#]",
  chart: "/\\",
  bell: "(i)",
  server: "[=]",
  users: "(:)",
  shield: "{!}",
  refresh: "<>",
  bot: "@",
  hammer: "T",
  tree: "Y",
  brain: "(~)",
  gear: "*",
};

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
  return (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm font-bold">
            CP
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-100">CodePulse</h1>
            <p className="text-[10px] text-gray-500">Telemetry Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-gray-800/50 text-gray-100"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/30"
              }`
            }
          >
            <span className="w-5 text-center text-xs font-mono opacity-60">
              {iconMap[item.icon]}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Connection Status */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
          <span>Connected to Convex</span>
        </div>
      </div>
    </>
  );
}

function CrtToggle({
  crtEnabled,
  setCrtEnabled,
}: {
  crtEnabled: boolean;
  setCrtEnabled: (v: boolean) => void;
}) {
  const toggle = () => {
    const next = !crtEnabled;
    setCrtEnabled(next);
    localStorage.setItem("codepulse-crt", JSON.stringify(next));
    if (next) {
      document.body.classList.add("crt-active");
    } else {
      document.body.classList.remove("crt-active");
    }
    window.dispatchEvent(new Event("codepulse-crt-toggle"));
  };

  return (
    <button
      onClick={toggle}
      aria-label={crtEnabled ? "Disable CRT effect" : "Enable CRT effect"}
      title={crtEnabled ? "CRT effect ON — click to disable" : "CRT effect OFF — click to enable"}
      className={`p-1.5 rounded-lg transition-colors text-[10px] font-mono font-medium ${
        crtEnabled
          ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
          : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
      }`}
    >
      CRT
    </button>
  );
}

export default function DashboardLayout() {
  useAudioEvents();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [crtEnabled, setCrtEnabled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("codepulse-crt") ?? "false");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = () => {
      try {
        setCrtEnabled(JSON.parse(localStorage.getItem("codepulse-crt") ?? "false"));
      } catch {}
    };
    window.addEventListener("storage", handler);
    // Also listen for custom event for same-tab updates
    window.addEventListener("codepulse-crt-toggle", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("codepulse-crt-toggle", handler);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case "m":
          // Toggle audio mute (dispatch event for AmbientAudioPlayer)
          window.dispatchEvent(new Event("codepulse-toggle-audio"));
          break;
        case "p":
          // Cycle privacy level
          window.dispatchEvent(new Event("codepulse-cycle-privacy"));
          break;
        case "escape":
          // Close mobile sidebar
          setSidebarOpen(false);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-gray-950 border-r border-gray-800 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-gray-950 border-r border-gray-800 flex flex-col transform transition-transform duration-200 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button */}
        <div className="absolute top-3 right-3">
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <SidebarContent onNavClick={() => setSidebarOpen(false)} />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 flex-shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
          {/* Hamburger button - mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar menu"
            className="p-1 -ml-1 mr-3 text-gray-400 hover:text-gray-200 transition-colors md:hidden"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="text-sm text-gray-400">
            Astridr Runtime Telemetry
          </span>
          <div className="flex items-center gap-2">
            <PrivacyShield />
            <CrtToggle crtEnabled={crtEnabled} setCrtEnabled={setCrtEnabled} />
            <AmbientAudioPlayer />
            <div className="w-px h-5 bg-gray-800 mx-1" />
            <UserMenu />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-900 p-6">
          <AlertBanner />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* Onboarding Guide */}
      <OnboardingGuide />

      {/* CRT Overlay */}
      {crtEnabled && <div className="crt-overlay" />}
    </div>
  );
}

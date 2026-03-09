import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import AlertBanner from "../components/AlertBanner";
import ErrorBoundary from "../components/ErrorBoundary";
import OnboardingGuide from "../components/OnboardingGuide";
import UserMenu from "../components/UserMenu";
import PrivacyShield from "../components/PrivacyShield";
import AmbientAudioPlayer from "../components/AmbientAudioPlayer";

const navItems = [
  { to: "/", label: "Dashboard", icon: "grid" },
  { to: "/capabilities", label: "Capabilities", icon: "cpu" },
  { to: "/analytics", label: "Analytics", icon: "chart" },
  { to: "/alerts", label: "Alerts", icon: "bell" },
  { to: "/infrastructure", label: "Infrastructure", icon: "server" },
  { to: "/profiles", label: "Profiles", icon: "users" },
  { to: "/security", label: "Security", icon: "shield" },
  { to: "/self-healing", label: "Self-Healing", icon: "refresh" },
  { to: "/build", label: "Build", icon: "hammer" },
  { to: "/forge", label: "Forge", icon: "tree" },
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
  hammer: "T",
  tree: "Y",
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
      <nav className="flex-1 overflow-y-auto py-2 px-2">
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
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Connected to Convex
        </div>
      </div>
    </>
  );
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    </div>
  );
}

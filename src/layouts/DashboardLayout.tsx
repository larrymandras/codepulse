import { NavLink, Outlet } from "react-router-dom";
import AlertBanner from "../components/AlertBanner";

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
  gear: "*",
};

export default function DashboardLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col">
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
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-12 flex-shrink-0 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
          <span className="text-sm text-gray-400">Astridr Runtime Telemetry</span>
          <span className="text-xs text-gray-600 font-mono">v0.1.0</span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-900 p-6">
          <AlertBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

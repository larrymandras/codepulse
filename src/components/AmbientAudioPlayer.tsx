import { useEffect, useState, useRef, useCallback } from "react";
import { useAmbient, type PresetName } from "../contexts/AmbientContext";
import { useHeroStats } from "../hooks/useHeroStats";
import { Volume2, VolumeX } from "lucide-react";

const PRESETS: { value: PresetName; label: string }[] = [
  { value: "forge", label: "Forge" },
  { value: "deepSpace", label: "Deep Space" },
  { value: "rain", label: "Rain" },
  { value: "serverRoom", label: "Server Room" },
  { value: "lofi", label: "Lo-fi" },
  { value: "silent", label: "Silent" },
];

export default function AmbientAudioPlayer() {
  const { enabled, toggle, preset, setPreset, setHealth } = useAmbient();
  const stats = useHeroStats();
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropRef = useRef<HTMLDivElement>(null);

  // Sync system health → audio engine
  useEffect(() => {
    setHealth(stats.health);
  }, [stats.health, setHealth]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keyboard navigation for dropdown
  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((i) => (i + 1) % PRESETS.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((i) => (i - 1 + PRESETS.length) % PRESETS.length);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0) {
            setPreset(PRESETS[focusedIndex].value);
            setOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
      }
    },
    [open, focusedIndex, setPreset]
  );

  // Reset focus index when dropdown opens
  useEffect(() => {
    if (open) {
      const idx = PRESETS.findIndex((p) => p.value === preset);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [open, preset]);

  return (
    <div className="relative flex items-center gap-1" ref={dropRef}>
      {/* Toggle button with equalizer */}
      <button
        onClick={toggle}
        aria-label={enabled ? "Mute ambient audio" : "Enable ambient audio"}
        title={enabled ? "Ambient audio ON — click to mute (M)" : "Ambient audio OFF — click to enable (M)"}
        className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1.5 ${
          enabled
            ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
            : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
        }`}
      >
        {enabled ? (
          <Volume2 className="h-4 w-4" />
        ) : (
          <VolumeX className="h-4 w-4" />
        )}
        {enabled && (
          <span className="flex items-end gap-[2px] h-3 text-emerald-400">
            <span className="eq-bar eq-bar-1" />
            <span className="eq-bar eq-bar-2" />
            <span className="eq-bar eq-bar-3" />
          </span>
        )}
        {!enabled && (
          <span className="text-[9px] uppercase tracking-wider opacity-60">Audio</span>
        )}
      </button>

      {/* Preset selector (only when enabled) */}
      {enabled && (
        <button
          onClick={() => setOpen((p) => !p)}
          onKeyDown={handleDropdownKeyDown}
          aria-label={`Ambient preset: ${PRESETS.find((p) => p.value === preset)?.label ?? preset}. Click to change`}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="px-2 py-1 rounded-lg text-[10px] text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors truncate max-w-[80px]"
          title="Change ambient preset"
        >
          {PRESETS.find((p) => p.value === preset)?.label ?? preset}
        </button>
      )}

      {/* Dropdown */}
      {open && enabled && (
        <div
          role="listbox"
          aria-label="Ambient audio presets"
          className="absolute top-full right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[120px] py-1"
        >
          {PRESETS.map((p, idx) => (
            <button
              key={p.value}
              role="option"
              aria-selected={preset === p.value}
              onClick={() => {
                setPreset(p.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                preset === p.value
                  ? "text-emerald-400 bg-emerald-600/10"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              } ${focusedIndex === idx ? "ring-1 ring-indigo-500" : ""}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

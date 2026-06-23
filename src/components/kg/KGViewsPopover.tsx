import { useState } from "react";
import { Bookmark, BookmarkPlus, Trash2, Link, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SavedKgView } from "../../hooks/useSavedViews";
import type { Id } from "../../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KGViewsPopoverProps {
  views: SavedKgView[];
  activeViewId: string | null;
  onLoadView: (view: SavedKgView) => void;
  onDeleteView: (id: Id<"savedKgViews">) => void;
  onCopyLink: (shareToken: string) => void;
  onSaveView: (name: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function KGViewsPopover({
  views,
  activeViewId,
  onLoadView,
  onDeleteView,
  onCopyLink,
  onSaveView,
}: KGViewsPopoverProps) {
  // Save-name inline expand state
  const [expanding, setExpanding] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [shake, setShake] = useState(false);

  const handleSaveClick = () => {
    setExpanding(true);
    setSaveName("");
  };

  const handleConfirmSave = () => {
    const trimmed = saveName.trim();
    if (!trimmed) {
      // Empty-name no-op with shake
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }
    onSaveView(trimmed);
    setExpanding(false);
    setSaveName("");
  };

  const handleCancelSave = () => {
    setExpanding(false);
    setSaveName("");
  };

  const handleSaveKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirmSave();
    } else if (e.key === "Escape") {
      handleCancelSave();
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Save view — inline expand */}
      {expanding ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={handleSaveKeyDown}
            onBlur={handleCancelSave}
            placeholder="Name this view…"
            className={`w-48 font-mono text-sm h-8 ${shake ? "animate-[shake_0.2s_ease-in-out]" : ""}`}
            aria-label="View name"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onMouseDown={(e) => {
              // Prevent blur from firing before click
              e.preventDefault();
              handleConfirmSave();
            }}
            aria-label="Confirm save"
          >
            <Check className="h-3.5 w-3.5 text-primary" />
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-sm"
          onClick={handleSaveClick}
        >
          <BookmarkPlus className="h-3.5 w-3.5 mr-1.5" />
          Save view
        </Button>
      )}

      {/* Views popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="font-mono text-sm">
            <Bookmark className="h-3.5 w-3.5 mr-1.5" />
            Views
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-4" side="bottom" align="end">
          {/* Header */}
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            SAVED VIEWS
          </p>

          {views.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
              <Bookmark className="h-5 w-5 text-primary/30" />
              <p className="text-sm text-muted-foreground font-mono">
                No saved views yet
              </p>
              <p className="text-xs text-muted-foreground/60">
                Save the current lens, filters, and focus as a named view —
                retrieve it in any session.
              </p>
            </div>
          ) : (
            /* View list */
            <div className="max-h-[320px] overflow-y-auto custom-scrollbar space-y-0.5">
              {views.map((view) => (
                // Use a div with role="button" (not a <button>) to avoid nested
                // <button> invalid HTML — action icons inside are their own buttons.
                <div
                  key={view._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onLoadView(view)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onLoadView(view);
                    }
                  }}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors rounded-[var(--radius-sm)] group ${
                    activeViewId === view._id
                      ? "border-l-2 border-primary bg-primary/5"
                      : ""
                  }`}
                  aria-label={view.name}
                >
                  <Bookmark className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{view.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      Saved {relativeTime(view.createdAt)}
                    </p>
                  </div>
                  {/* Hover-reveal actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyLink(view.shareToken);
                      }}
                      aria-label={`Copy link for ${view.name}`}
                      className="p-1 text-muted-foreground hover:text-primary"
                    >
                      <Link className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteView(view._id);
                      }}
                      aria-label={`Delete view ${view.name}`}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

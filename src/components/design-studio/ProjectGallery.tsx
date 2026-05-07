import { useState } from "react";
import { Palette } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import { EntityRow } from "@/components/EntityRow";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Project {
  _id: any;
  odProjectId: string;
  name: string;
  skillId?: string;
  designSystemId?: string;
  status: string;
  odCreatedAt: number;
  odUpdatedAt: number;
}

interface ProjectGalleryProps {
  projects: Project[];
  onSync: () => void;
  syncing: boolean;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-500/10 text-green-400 border-green-500/30";
    case "active":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
    case "failed":
      return "bg-red-500/10 text-red-400 border-red-500/30";
    default:
      return "";
  }
}

export default function ProjectGallery({ projects, onSync, syncing }: ProjectGalleryProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const removeProject = useMutation(api.designProjects.remove);

  async function handleDelete() {
    if (!selectedProject) return;
    setDeleting(true);
    try {
      await removeProject({ odProjectId: selectedProject.odProjectId });
      setSelectedProject(null);
      setShowDeleteDialog(false);
      toast.success("Project deleted");
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Section heading */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">My Projects</h2>
        <button
          onClick={onSync}
          disabled={syncing}
          className="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Refresh"}
        </button>
      </div>

      {/* Empty state */}
      {projects.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-foreground">No saved designs yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Complete the Native UI workflow to save your first design, or use Embedded Studio to
            create one directly.
          </p>
        </div>
      ) : (
        <div className="bg-card/60 border border-border/40 rounded-xl overflow-hidden">
          {projects.map((project) => (
            <EntityRow
              key={project.odProjectId}
              icon={<Palette className="h-4 w-4" />}
              primary={project.name}
              secondary={`${project.skillId ?? "-"} / ${project.designSystemId ?? "-"} · ${new Date(project.odCreatedAt).toLocaleDateString()}`}
              trailing={
                <Badge variant="secondary" className={statusBadgeClass(project.status)}>
                  {project.status}
                </Badge>
              }
              onClick={() => setSelectedProject(project)}
            />
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet
        open={!!selectedProject}
        onOpenChange={(open) => {
          if (!open) setSelectedProject(null);
        }}
      >
        <SheetContent className="w-[480px]">
          <SheetHeader>
            <SheetTitle>{selectedProject?.name ?? ""}</SheetTitle>
          </SheetHeader>
          {selectedProject && (
            <div className="mt-4 space-y-3 px-1">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium text-foreground">Skill:</span>{" "}
                  {selectedProject.skillId ?? "—"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Design System:</span>{" "}
                  {selectedProject.designSystemId ?? "—"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Created:</span>{" "}
                  {new Date(selectedProject.odCreatedAt).toLocaleDateString()}
                </p>
                <p>
                  <span className="font-medium text-foreground">Status:</span>{" "}
                  {selectedProject.status}
                </p>
              </div>
              <div className="pt-4 border-t border-border/40">
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-sm text-destructive hover:text-destructive/80"
                >
                  Delete Project
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project from your gallery. The source files in Open Design are not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

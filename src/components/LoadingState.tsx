export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
      <div className="w-8 h-8 border-2 border-border border-t-indigo-500 rounded-full animate-spin" />
      <span className="text-base text-muted-foreground">Loading...</span>
    </div>
  );
}

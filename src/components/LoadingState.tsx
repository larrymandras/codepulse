export default function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
      <div className="w-8 h-8 border-2 border-gray-600 border-t-indigo-500 rounded-full animate-spin" />
      <span className="text-sm text-gray-400">Loading...</span>
    </div>
  );
}

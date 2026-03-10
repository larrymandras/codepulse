export default function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1.5">
      <span className="w-4 h-4 rounded-full bg-gray-700/60 text-gray-400 text-[10px] flex items-center justify-center cursor-help group-hover:bg-gray-600/80 group-hover:text-gray-200 transition-colors">
        i
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-700 text-xs text-gray-200 whitespace-normal w-56 text-center opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-lg">
        {text}
      </span>
    </span>
  );
}

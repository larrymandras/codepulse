export function NavBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      className="ml-auto w-4 h-4 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center shrink-0"
      aria-label={`${count} pending`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function NavBadgeDot({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-500"
      aria-label={`${count} pending`}
    />
  );
}

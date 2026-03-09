import { UserButton } from "@clerk/clerk-react";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function UserMenu() {
  if (!CLERK_KEY) {
    return (
      <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-[10px] text-gray-400 font-mono">
        ?
      </div>
    );
  }

  return <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-7 h-7" } }} />;
}

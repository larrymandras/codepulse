import { UserButton } from "@clerk/clerk-react";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function UserMenu() {
  if (!CLERK_KEY) {
    return (
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-mono">
        ?
      </div>
    );
  }

  return <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-7 h-7" } }} />;
}

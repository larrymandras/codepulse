import { type ReactNode } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";

/**
 * AuthGuard — wraps dashboard content.
 * If Clerk is configured (VITE_CLERK_PUBLISHABLE_KEY set), requires sign-in.
 * Otherwise, renders children directly (dev mode).
 */

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function AuthGuard({ children }: { children: ReactNode }) {
  if (!CLERK_KEY) return <>{children}</>;

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
              CP
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">CodePulse</h1>
              <p className="text-base text-muted-foreground mt-1">
                Sign in to access the telemetry dashboard
              </p>
            </div>
            <SignInButton mode="modal">
              <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-lg text-base font-medium transition-colors">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
    </>
  );
}

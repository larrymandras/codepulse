import { type ReactNode } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";

/**
 * AuthGuard — wraps dashboard content.
 * If Clerk is configured (VITE_CLERK_PUBLISHABLE_KEY set), requires sign-in.
 * Otherwise, renders children directly (dev mode).
 */

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function AuthGuard({ children }: { children: ReactNode }) {
  if (!CLERK_KEY) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-600 flex items-center justify-center text-2xl font-bold text-white">
            !
          </div>
          <h1 className="text-xl font-semibold text-gray-100">Authentication Not Configured</h1>
          <p className="text-sm text-gray-400 max-w-md">
            Set <code className="text-amber-400">VITE_CLERK_PUBLISHABLE_KEY</code> to enable access to the dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="flex h-screen items-center justify-center bg-gray-950">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
              CP
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-100">CodePulse</h1>
              <p className="text-sm text-gray-500 mt-1">
                Sign in to access the telemetry dashboard
              </p>
            </div>
            <SignInButton mode="modal">
              <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Sign In
              </button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>
    </>
  );
}

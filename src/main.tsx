import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { PrivacyProvider } from "./contexts/PrivacyContext";
import { AmbientProvider } from "./contexts/AmbientContext";
import App from "./App";
import "./index.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <PrivacyProvider>
        <AmbientProvider>{children}</AmbientProvider>
      </PrivacyProvider>
    </ConvexProvider>
  );
}

// CPHLTH-01: When Clerk is configured, bridge Clerk JWT to Convex identity so
// server-side ctx.auth.getUserIdentity() checks work on sensitive mutations.
function ClerkConvexProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <PrivacyProvider>
        <AmbientProvider>{children}</AmbientProvider>
      </PrivacyProvider>
    </ConvexProviderWithClerk>
  );
}

const tree = CLERK_KEY ? (
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <ClerkConvexProviders>
        <App />
      </ClerkConvexProviders>
    </ClerkProvider>
  </StrictMode>
) : (
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(tree);

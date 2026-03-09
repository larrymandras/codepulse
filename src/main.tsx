import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ClerkProvider } from "@clerk/clerk-react";
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

const tree = CLERK_KEY ? (
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY}>
      <Providers>
        <App />
      </Providers>
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

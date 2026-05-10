import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import NotFound from "@/pages/not-found";

import SuperAdminLogin from "@/pages/super-admin/login";
import SuperAdminDashboard from "@/pages/super-admin/dashboard";
import SuperAdminPlayers from "@/pages/super-admin/players";
import SuperAdminGangs from "@/pages/super-admin/gangs";
import SuperAdminAttacks from "@/pages/super-admin/attacks";
import SuperAdminPrison from "@/pages/super-admin/prison";
import SuperAdminCrimes from "@/pages/super-admin/crimes";
import SuperAdminCities from "@/pages/super-admin/cities";
import SuperAdminBlackMarket from "@/pages/super-admin/blackmarket";
import SuperAdminActivityLog from "@/pages/super-admin/activity-log";
import SuperAdminSettings from "@/pages/super-admin/settings";
import SuperAdminDev from "@/pages/super-admin/dev";
import SuperAdminItems from "@/pages/super-admin/items";

import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import Crimes from "@/pages/crimes";
import Cities from "@/pages/cities";
import BlackMarket from "@/pages/blackmarket";
import Players from "@/pages/players";
import Gangs from "@/pages/gangs";
import GangDetail from "@/pages/gang-detail";
import Weapons from "@/pages/weapons";
import Armor from "@/pages/armor";
import Bodyguards from "@/pages/bodyguards";
import Attack from "@/pages/attack";
import Prison from "@/pages/prison";
import Admin from "@/pages/admin";
import Ranks from "@/pages/ranks";
import Properties from "@/pages/properties";
import Bank from "@/pages/bank";
import SafeHouse from "@/pages/safe-house";
import Blackjack from "@/pages/blackjack";
import KillCalculator from "@/pages/kill-calculator";
import ChatPage from "@/pages/chat";
import PrivateChatPage from "@/pages/chat-private";
import Dead from "@/pages/dead";
import { Layout } from "@/components/layout";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#8B0000",
    colorForeground: "#eaeaea",
    colorMutedForeground: "#a3a3a3",
    colorDanger: "#ef4444",
    colorBackground: "#141414",
    colorInput: "#1a1a1a",
    colorInputForeground: "#eaeaea",
    colorNeutral: "#333333",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#141414] border border-[#333] rounded-xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-heading",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-foreground",
    footerActionLink: "text-primary hover:text-primary/80",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-500",
    alertText: "text-foreground",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function DeathGate({ children }: { children: React.ReactNode }) {
  const { data: profile } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  if (profile?.isPermanentlyDead) {
    return <Redirect to="/dead" />;
  }
  return <>{children}</>;
}

function ProtectedRoute({ component: Component, allowDead = false }: { component: React.ComponentType; allowDead?: boolean }) {
  return (
    <>
      <Show when="signed-in">
        {allowDead ? (
          <Component />
        ) : (
          <DeathGate>
            <Layout>
              <Component />
            </Layout>
          </DeathGate>
        )}
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function SuperAdminRoutes() {
  return (
    <Switch>
      <Route path="/super-admin/login" component={SuperAdminLogin} />
      <Route path="/super-admin/dashboard" component={SuperAdminDashboard} />
      <Route path="/super-admin/players" component={SuperAdminPlayers} />
      <Route path="/super-admin/gangs" component={SuperAdminGangs} />
      <Route path="/super-admin/attacks" component={SuperAdminAttacks} />
      <Route path="/super-admin/prison" component={SuperAdminPrison} />
      <Route path="/super-admin/crimes" component={SuperAdminCrimes} />
      <Route path="/super-admin/cities" component={SuperAdminCities} />
      <Route path="/super-admin/blackmarket" component={SuperAdminBlackMarket} />
      <Route path="/super-admin/activity-log" component={SuperAdminActivityLog} />
      <Route path="/super-admin/items" component={SuperAdminItems} />
      <Route path="/super-admin/settings" component={SuperAdminSettings} />
      <Route path="/super-admin/dev" component={SuperAdminDev} />
      <Route><Redirect to="/super-admin/login" /></Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <I18nProvider>
          <TooltipProvider>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />

              <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
              <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
              <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
              <Route path="/crimes"><ProtectedRoute component={Crimes} /></Route>
              <Route path="/cities"><ProtectedRoute component={Cities} /></Route>

              <Route path="/players"><ProtectedRoute component={Players} /></Route>
              <Route path="/gangs"><ProtectedRoute component={Gangs} /></Route>
              <Route path="/gang/:id"><ProtectedRoute component={GangDetail} /></Route>
              <Route path="/weapons"><ProtectedRoute component={Weapons} /></Route>
              <Route path="/armor"><ProtectedRoute component={Armor} /></Route>
              <Route path="/bodyguards"><ProtectedRoute component={Bodyguards} /></Route>
              <Route path="/attack"><ProtectedRoute component={Attack} /></Route>
              <Route path="/attacks"><ProtectedRoute component={Attack} /></Route>
              <Route path="/blackmarket"><ProtectedRoute component={BlackMarket} /></Route>
              <Route path="/prison"><ProtectedRoute component={Prison} /></Route>
              <Route path="/admin"><ProtectedRoute component={Admin} /></Route>
              <Route path="/ranks"><ProtectedRoute component={Ranks} /></Route>
              <Route path="/properties"><ProtectedRoute component={Properties} /></Route>
              <Route path="/bank"><ProtectedRoute component={Bank} /></Route>
              <Route path="/safe-house"><ProtectedRoute component={SafeHouse} /></Route>
              <Route path="/blackjack"><ProtectedRoute component={Blackjack} /></Route>
              <Route path="/kill-calculator"><ProtectedRoute component={KillCalculator} /></Route>
              <Route path="/chat"><ProtectedRoute component={ChatPage} /></Route>
              <Route path="/chat/private/:playerId"><ProtectedRoute component={PrivateChatPage} /></Route>
              <Route path="/dead"><ProtectedRoute component={Dead} allowDead /></Route>

              <Route component={NotFound} />
            </Switch>
            <Toaster />
          </TooltipProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function AppRouter() {
  const [location] = useLocation();
  if (location.startsWith("/super-admin")) {
    return <SuperAdminRoutes />;
  }
  return <ClerkProviderWithRoutes />;
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppRouter />
    </WouterRouter>
  );
}

export default App;

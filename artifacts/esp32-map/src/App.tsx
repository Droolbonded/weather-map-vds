import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import Layout from "@/components/Layout";
import MapPage from "@/pages/MapPage";
import DevicesPage from "@/pages/DevicesPage";
import DeviceDetailPage from "@/pages/DeviceDetailPage";
import Esp32GuidePage from "@/pages/Esp32GuidePage";
import NotificationsPage from "@/pages/NotificationsPage";
import NotFound from "@/pages/not-found";
import { setBaseUrl } from "@workspace/api-client-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15000,
    },
  },
});

// Configure API to talk to Alwaysdata instead of VDS
// We add a trailing slash to help with PATH_INFO routing in PHP
setBaseUrl("https://67zonguldak.alwaysdata.net/api.php/");

function Router() {

  return (
    <Layout>
      <Switch>
        <Route path="/" component={MapPage} />
        <Route path="/devices" component={DevicesPage} />
        <Route path="/devices/:id" component={DeviceDetailPage} />
        <Route path="/esp32-guide" component={Esp32GuidePage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

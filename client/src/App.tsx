import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import IntegrationExample from "./pages/IntegrationExample";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"}>{() => <DashboardLayout><Home /></DashboardLayout>}</Route>
      <Route path={"/eventos"}>{() => <DashboardLayout><Home /></DashboardLayout>}</Route>
      <Route path={"/historico"}>{() => <DashboardLayout><Home /></DashboardLayout>}</Route>
      <Route path={"/workflow"}>{() => <DashboardLayout><Home /></DashboardLayout>}</Route>
      <Route path={"/configuracoes"}>{() => <DashboardLayout><Home /></DashboardLayout>}</Route>
      <Route path={"/assinaturas"}>{() => <DashboardLayout><Home /></DashboardLayout>}</Route>
      <Route path={"/exemplos-integracao"} component={IntegrationExample} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

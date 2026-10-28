import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 2 minutes — navigating between pages
        // won't trigger a re-fetch if the data was loaded within this window.
        staleTime: 1000 * 60 * 2,
        // Keep unused data in the cache for 10 minutes before garbage-collecting.
        gcTime: 1000 * 60 * 10,
        // Never retry on 4xx errors; retry once on network/5xx errors.
        retry: (failureCount, error: any) => {
          const status = error?.status ?? error?.response?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
        // Don't re-fetch just because the user switched back to this tab.
        refetchOnWindowFocus: false,
        // Don't re-fetch when the component re-mounts (e.g. navigating back).
        refetchOnMount: false,
      },
    },
  });
  
  const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor;
  const history = isCapacitor ? createHashHistory() : undefined;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    history,
  });

  return router;
};

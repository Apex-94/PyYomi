import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ColorModeProvider, useColorMode } from "../theme/ColorModeContext";
import { createAppTheme } from "../theme/createAppTheme";

function ThemedApp({ children }: { children: React.ReactNode }) {
    const { mode, uiMode } = useColorMode();
    const theme = createAppTheme(mode, uiMode);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                staleTime: 1000 * 60 * 5, // 5 minutes
            }
        }
    }));

    return (
        <ColorModeProvider>
            <ThemedApp>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </ThemedApp>
        </ColorModeProvider>
    );
}

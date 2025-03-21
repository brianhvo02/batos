import App from './App.tsx';
import './reset.css';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MapProvider } from 'react-map-gl/maplibre';
import { BrowserRouter, Route, Routes } from 'react-router';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
});

const rootEl = document.getElementById('root');
if (rootEl) {
    createRoot(rootEl).render(
        <StrictMode>
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <MapProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/" element={<App />} />
                        </Routes>
                    </BrowserRouter>
                </MapProvider>
            </ThemeProvider>
        </StrictMode>,
    );
}


import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#0f172a',
            paper: '#1e293b',
        },
        primary: {
            main: '#10b981',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#38bdf8',
        },
        text: {
            primary: '#f8fafc',
            secondary: '#94a3b8',
        },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 700,
        },
        h2: {
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 600,
        },
        h3: {
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 600,
        },
        button: {
            textTransform: 'none',
            fontWeight: 500,
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 9999, // Pill shape
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none', // Remove default gradient in dark mode
                },
            },
        },
    },
});

export default theme;

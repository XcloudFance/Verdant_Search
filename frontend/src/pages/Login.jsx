import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Stack, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AmbientBackground from '../components/common/AmbientBackground';
import SpaIcon from '@mui/icons-material/Spa';
import AnimatedPage from '../components/layout/AnimatedPage';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({ email: '', password: '' });
    const { login } = useAuth();
    const navigate = useNavigate();

    // Email validation
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Reset errors
        const newErrors = { email: '', password: '' };

        // Validate email
        if (!email) {
            newErrors.email = 'Email is required';
        } else if (!validateEmail(email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        // Validate password
        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        // If there are errors, show them and don't submit
        if (newErrors.email || newErrors.password) {
            setErrors(newErrors);
            return;
        }

        const success = await login(email, password);
        if (success) {
            navigate('/');
        }
    };

    return (
        <AnimatedPage>
            <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                <AmbientBackground />
                <Paper sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: 4, backdropFilter: 'blur(20px)', bgcolor: 'rgba(30, 41, 59, 0.7)' }}>
                    <Stack alignItems="center" mb={4}>
                        <SpaIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                        <Typography variant="h4" fontWeight="bold">Welcome Back</Typography>
                        <Typography variant="body2" color="text.secondary">Sign in to continue to Verdant</Typography>
                    </Stack>

                    <form onSubmit={handleSubmit}>
                        <Stack spacing={3}>
                            <TextField
                                label="Email"
                                type="email"
                                fullWidth
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (errors.email) setErrors({ ...errors, email: '' });
                                }}
                                variant="outlined"
                                error={!!errors.email}
                                helperText={errors.email}
                            />
                            <TextField
                                label="Password"
                                type="password"
                                fullWidth
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (errors.password) setErrors({ ...errors, password: '' });
                                }}
                                variant="outlined"
                                error={!!errors.password}
                                helperText={errors.password}
                            />
                            <Button type="submit" variant="contained" size="large" fullWidth>
                                Sign In
                            </Button>
                        </Stack>
                    </form>

                    <Box mt={3} textAlign="center">
                        <Typography variant="body2" color="text.secondary">
                            Don't have an account? <Link component="button" onClick={() => navigate('/register')} color="primary">Sign up</Link>
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        </AnimatedPage>
    );
};

export default Login;

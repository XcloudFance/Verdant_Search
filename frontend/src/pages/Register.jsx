import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Stack, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AmbientBackground from '../components/common/AmbientBackground';
import SpaIcon from '@mui/icons-material/Spa';
import AnimatedPage from '../components/layout/AnimatedPage';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({ name: '', email: '', password: '' });
    const { register } = useAuth();
    const navigate = useNavigate();

    // Email validation
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Reset errors
        const newErrors = { name: '', email: '', password: '' };

        // Validate name
        if (!name) {
            newErrors.name = 'Name is required';
        } else if (name.length < 2) {
            newErrors.name = 'Name must be at least 2 characters';
        }

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
        if (newErrors.name || newErrors.email || newErrors.password) {
            setErrors(newErrors);
            return;
        }

        const success = await register(name, email, password);
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
                        <Typography variant="h4" fontWeight="bold">Create Account</Typography>
                        <Typography variant="body2" color="text.secondary">Join Verdant today</Typography>
                    </Stack>

                    <form onSubmit={handleSubmit}>
                        <Stack spacing={3}>
                            <TextField
                                label="Full Name"
                                fullWidth
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (errors.name) setErrors({ ...errors, name: '' });
                                }}
                                variant="outlined"
                                error={!!errors.name}
                                helperText={errors.name}
                            />
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
                                Sign Up
                            </Button>
                        </Stack>
                    </form>

                    <Box mt={3} textAlign="center">
                        <Typography variant="body2" color="text.secondary">
                            Already have an account? <Link component="button" onClick={() => navigate('/login')} color="primary">Sign in</Link>
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        </AnimatedPage>
    );
};

export default Register;

import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check local storage for existing token
        const token = localStorage.getItem('verdant_token');
        const storedUser = localStorage.getItem('verdant_user');
        if (token && storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        try {
            const response = await fetch('http://localhost:8080/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Login failed');
            }

            const data = await response.json();
            setUser(data.user);
            localStorage.setItem('verdant_token', data.token);
            localStorage.setItem('verdant_user', JSON.stringify(data.user));
            return true;
        } catch (error) {
            console.error('Login error:', error);
            alert(error.message);
            return false;
        }
    };

    const register = async (name, email, password) => {
        try {
            const response = await fetch('http://localhost:8080/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Registration failed');
            }

            const data = await response.json();
            setUser(data.user);
            localStorage.setItem('verdant_token', data.token);
            localStorage.setItem('verdant_user', JSON.stringify(data.user));
            return true;
        } catch (error) {
            console.error('Registration error:', error);
            alert(error.message);
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('verdant_token');
        localStorage.removeItem('verdant_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

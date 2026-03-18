import React, { createContext, useState, useContext, useEffect } from 'react';
import { GO_API } from '../config';

const HistoryContext = createContext(null);

export const HistoryProvider = ({ children }) => {
    const [history, setHistory] = useState([]);

    useEffect(() => {
        // Fetch history from backend on mount
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        const token = localStorage.getItem('verdant_token');
        if (!token) return;

        try {
            const response = await fetch(`${GO_API}/api/history`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setHistory(data || []);
            }
        } catch (error) {
            console.error('Failed to fetch history:', error);
        }
    };

    const addToHistory = async (query) => {
        if (!query) return;
        const token = localStorage.getItem('verdant_token');
        if (!token) return;

        try {
            const response = await fetch(`${GO_API}/api/history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ query }),
            });

            if (response.ok) {
                // Refresh history after adding
                fetchHistory();
            }
        } catch (error) {
            console.error('Failed to add to history:', error);
        }
    };

    const clearHistory = async () => {
        const token = localStorage.getItem('verdant_token');
        if (!token) return;

        try {
            const response = await fetch(`${GO_API}/api/history`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                setHistory([]);
            }
        } catch (error) {
            console.error('Failed to clear history:', error);
        }
    };

    const removeFromHistory = async (id) => {
        const token = localStorage.getItem('verdant_token');
        if (!token) return;

        try {
            const response = await fetch(`${GO_API}/api/history/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                setHistory((prev) => prev.filter(item => item.id !== id));
            }
        } catch (error) {
            console.error('Failed to remove from history:', error);
        }
    };

    return (
        <HistoryContext.Provider value={{ history, addToHistory, clearHistory, removeFromHistory }}>
            {children}
        </HistoryContext.Provider>
    );
};

export const useHistory = () => useContext(HistoryContext);

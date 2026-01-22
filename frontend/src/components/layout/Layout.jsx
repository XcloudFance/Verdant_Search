import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ChatWidget from '../features/ChatWidget';

const Layout = () => {
    const location = useLocation();
    // Don't show global chat on auth pages OR results page (Results page handles its own chat with data)
    const showChat = !['/login', '/register', '/results'].includes(location.pathname);

    return (
        <>
            <Outlet />
            {showChat && <ChatWidget />}
        </>
    );
};

export default Layout;

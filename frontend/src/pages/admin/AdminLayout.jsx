import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, IconButton, Tooltip, AppBar, Toolbar, Chip
} from '@mui/material';
import {
  BugReport as CrawlerIcon,
  Storage as IndexIcon,
  Analytics as AnalyticsIcon,
  Settings as ConfigIcon,
  Dashboard as DashboardIcon,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Home as HomeIcon,
  ManageSearch as ManageSearchIcon,
  Backup as BackupIcon
} from '@mui/icons-material';

const DRAWER_WIDTH = 240;
const COLLAPSED_WIDTH = 60;

const navItems = [
  { label: 'Overview', icon: <DashboardIcon />, path: '/admin' },
  { label: 'Crawler Fleet', icon: <CrawlerIcon />, path: '/admin/crawler' },
  { label: 'Index & DB', icon: <IndexIcon />, path: '/admin/index' },
  { label: 'Analytics', icon: <AnalyticsIcon />, path: '/admin/analytics' },
  { label: 'Search Debugger', icon: <ManageSearchIcon />, path: '/admin/search-debug' },
  { label: 'Backup & Restore', icon: <BackupIcon />, path: '/admin/backup' },
  { label: 'Configuration', icon: <ConfigIcon />, path: '/admin/config' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const drawerWidth = collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0a0a0f' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            bgcolor: '#111117',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            transition: 'width 0.2s',
            overflow: 'hidden',
          },
        }}
      >
        {/* Logo */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 64 }}>
          {!collapsed && (
            <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 700, flex: 1 }}>
              Verdant Admin
            </Typography>
          )}
          <IconButton size="small" onClick={() => setCollapsed(!collapsed)} sx={{ color: 'text.secondary' }}>
            {collapsed ? <ExpandIcon /> : <CollapseIcon />}
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

        <List sx={{ px: 1, pt: 1 }}>
          {navItems.map((item) => {
            const active = location.pathname === item.path ||
              (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Tooltip key={item.path} title={collapsed ? item.label : ''} placement="right">
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: 2,
                      bgcolor: active ? 'rgba(16,185,129,0.15)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                      minHeight: 44,
                    }}
                  >
                    <ListItemIcon sx={{ color: active ? '#10b981' : 'text.secondary', minWidth: collapsed ? 'auto' : 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: 14,
                          color: active ? '#10b981' : 'text.primary',
                          fontWeight: active ? 600 : 400
                        }}
                      />
                    )}
                  </ListItemButton>
                </ListItem>
              </Tooltip>
            );
          })}
        </List>

        <Box sx={{ mt: 'auto', p: 1 }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1 }} />
          <Tooltip title={collapsed ? 'Back to Search' : ''} placement="right">
            <ListItemButton
              onClick={() => navigate('/')}
              sx={{ borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
            >
              <ListItemIcon sx={{ color: 'text.secondary', minWidth: collapsed ? 'auto' : 40 }}>
                <HomeIcon />
              </ListItemIcon>
              {!collapsed && <ListItemText primary="Back to Search" primaryTypographyProps={{ fontSize: 14, color: 'text.secondary' }} />}
            </ListItemButton>
          </Tooltip>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: '#111117', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Toolbar>
            <Chip label="Admin Panel" size="small" sx={{ bgcolor: 'rgba(16,185,129,0.2)', color: '#10b981', mr: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Verdant Search Management Console
            </Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}

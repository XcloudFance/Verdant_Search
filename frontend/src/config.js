/**
 * Verdant Search — API endpoint configuration
 *
 * For local development these default to localhost.
 * For production deployment, set in frontend/.env:
 *   VITE_PYTHON_API_URL=http://your-server-ip:8001
 *   VITE_GO_API_URL=http://your-server-ip:8080
 */
export const PYTHON_API = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8001';
export const GO_API     = import.meta.env.VITE_GO_API_URL     || 'http://localhost:8080';

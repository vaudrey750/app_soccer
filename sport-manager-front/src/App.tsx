import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TeamProvider } from './context/TeamContext';
import { SessionManager } from './components/SessionManager';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import PlayerDashboard from './pages/player/Dashboard';
import CoachDashboard from './pages/coach/Dashboard';
import AdminDashboard from './pages/admin/Dashboard';
import CoachConvocations from './pages/coach/Convocations';
import MatchCenter from './pages/coach/MatchCenter';
import Profile from './pages/player/Profile';
import CalendarPage from './pages/player/Calendar';
import MyClub from './pages/player/MyClub';
import Career from './pages/player/Career';
import PlayerStatistics from './pages/player/Statistics';
import CoachStatistics from './pages/coach/Statistics';
import CreateEvent from './pages/coach/CreateEvent';
import EventDetails from './pages/events/EventDetails';
import PlayerLayout from './components/templates/PlayerLayout';

// Simple ProtectedRoute wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    
    if (!isAuthenticated) return <Navigate to="/login" />;
    
    // Wrap protected routes in PlayerLayout
    return (
        <PlayerLayout>
            {children}
        </PlayerLayout>
    );
};

const DashboardRouter = () => {
    const { user } = useAuth();
    if (user?.role === 'ADMIN' || user?.role === 'PRESIDENT') {
        return <AdminDashboard />;
    }
    if (user?.role === 'COACH') {
        return <CoachDashboard />;
    }
    return <PlayerDashboard />;
};

const StatisticsRouter = () => {
    const { user } = useAuth();
    if (user?.role === 'COACH') {
        return <CoachStatistics />;
    }
    return <PlayerStatistics />;
};

function App() {
  return (
    <AuthProvider>
      <TeamProvider>
                <SessionManager />
        <Routes>
          <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={
              <ProtectedRoute>
                  <DashboardRouter />
              </ProtectedRoute>
          } />
          {/* Coach Routes */}
          <Route path="/match-center/:id" element={
              <ProtectedRoute>
                  <MatchCenter />
              </ProtectedRoute>
          } />
          <Route path="/convocations" element={
              <ProtectedRoute>
                  <CoachConvocations />
              </ProtectedRoute>
          } />
          <Route path="/profile" element={
              <ProtectedRoute>
                  <Profile />
              </ProtectedRoute>
          } />
          <Route path="/career" element={
              <ProtectedRoute>
                  <Career />
              </ProtectedRoute>
          } />
          {/* Add placeholders for other nav items if needed */}
          <Route path="/calendar" element={
              <ProtectedRoute>
                  <CalendarPage />
              </ProtectedRoute>
          } />
          <Route path="/events/new" element={
              <ProtectedRoute>
                  <CreateEvent />
              </ProtectedRoute>
          } />
          <Route path="/events/edit/:id" element={
              <ProtectedRoute>
                  <CreateEvent />
              </ProtectedRoute>
          } />
          <Route path="/events/:id" element={
              <ProtectedRoute>
                  <EventDetails />
              </ProtectedRoute>
          } />
          <Route path="/my-club" element={
              <ProtectedRoute>
                   <MyClub />
              </ProtectedRoute>
          } />
          <Route path="/statistics" element={
              <ProtectedRoute>
                   <StatisticsRouter />
              </ProtectedRoute>
          } />
        </Routes>
      </TeamProvider>
    </AuthProvider>
  );
}

export default App;

// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Gallery from "./pages/Gallery";
import FolderView from "./pages/FolderView";
import Upload from "./pages/Upload";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ErrorPage from "./pages/ErrorPage";
import PlayerPage from "./pages/PlayerPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Gallery />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* Fixed folder routing - now it should work properly */}
            <Route
              path="/browse/:type"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FolderView />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* Specific folder within type */}
            <Route
              path="/folder/:type/:folder"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FolderView />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Upload />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <Layout>
                    <Admin />
                  </Layout>
                </ProtectedRoute>
              }
            />
              {/* New dedicated player route - NO Layout wrapper for fullscreen */}
              <Route 
              path="/player" 
              element={
              <ProtectedRoute>
                <PlayerPage />
              </ProtectedRoute>} />
              
            {/* Catch-all route */}
            <Route path="*" element={<ErrorPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Toaster } from "sonner";
import { dbAPI } from "@/lib/db";
import { Login } from "@/routes/Login";
import { Feed } from "@/routes/Feed";
import { Direct } from "@/routes/Direct";
import { Notifications } from "@/routes/Notifications";
import { Settings } from "@/routes/Settings";
import { Admin } from "@/routes/Admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Radio, MessageSquare, Inbox, Settings as SettingsIcon, Shield, 
  LogOut, Lock, ShieldAlert, EyeOff, Eye, RefreshCw 
} from "lucide-react";

// --- Blocked Screen Component ---
interface BlockedScreenProps {
  title: string;
  description: string;
  onSignOut: () => void;
}

const BlockedScreen: React.FC<BlockedScreenProps> = ({ title, description, onSignOut }) => {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-8 bg-background">
      <div className="glass max-w-md w-full rounded-xl p-6 sm:p-8 text-center border border-destructive/20 shadow-2xl space-y-5">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 shadow-lg shadow-destructive/5 text-destructive animate-pulse">
          <ShieldAlert className="h-7 w-7" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-destructive font-display">{title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>

        <div className="pt-2 border-t border-border/40">
          <Button 
            variant="outline" 
            onClick={onSignOut} 
            className="w-full cursor-pointer hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out of Account
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Content (inside Auth Provider) ---
const AppContent: React.FC = () => {
  const { 
    session, 
    profile, 
    isAdmin, 
    impersonatorProfile, 
    loading, 
    signOut, 
    refreshProfile,
    exitImpersonation 
  } = useAuth();
  const [currentHash, setCurrentHash] = useState(window.location.hash || "#/");
  const [unreadWarningsCount, setUnreadWarningsCount] = useState(0);

  // Listen to hash changes
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || "#/");
    };
    
    window.addEventListener("hashchange", handleHashChange);
    // If no hash, set default
    if (!window.location.hash) {
      window.location.hash = "#/";
    }
    
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Poll for warnings (especially unread ones) and profile updates
  useEffect(() => {
    if (!session) return;

    const checkStatusAndWarnings = async () => {
      try {
        // Refresh profile state (to catch suspensions/renames in real-time)
        await refreshProfile();
        
        // Get unread warnings count
        const warnings = await dbAPI.getWarnings();
        const unread = warnings.filter(w => !w.read).length;
        setUnreadWarningsCount(unread);
      } catch (e) {
        console.error("Error polling account status", e);
      }
    };

    checkStatusAndWarnings();
    
    const handleDbUpdate = () => {
      checkStatusAndWarnings();
    };
    
    window.addEventListener("classvault-db-update", handleDbUpdate);
    
    // Poll every 15s so suspensions/warnings apply instantly as backup
    const interval = setInterval(checkStatusAndWarnings, 15000);
    return () => {
      window.removeEventListener("classvault-db-update", handleDbUpdate);
      clearInterval(interval);
    };
  }, [session, refreshProfile]);

  // Auth Gate Loading Screen
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary animate-spin">
            <RefreshCw className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Decrypting vault keys...</p>
        </div>
      </div>
    );
  }

  // Render Login if no session
  if (!session) {
    return <Login />;
  }

  // Auth Gate: Missing Profile
  if (!profile) {
    return (
      <BlockedScreen
        title="Account Setup Needed"
        description="Your user session exists, but your student profile could not be retrieved. Please sign out and contact your classroom administrator."
        onSignOut={signOut}
      />
    );
  }

  // Auth Gate: Removed Status
  if (profile.status === "removed") {
    return (
      <BlockedScreen
        title="Account Removed"
        description="This student account has been removed from the classroom directory by the administrator. You no longer have access to this vault."
        onSignOut={signOut}
      />
    );
  }

  // Suspended students are placed in Read-Only Mode rather than being fully hard-blocked.
  // The block is handled inside database mutations and visually using a top banner.

  // Helper to determine active nav item
  const isActive = (hash: string) => {
    return currentHash === hash;
  };

  // Safe router rendering
  const renderActiveView = () => {
    switch (currentHash) {
      case "#/":
      case "#/feed":
        return <Feed />;
      case "#/direct":
        return <Direct />;
      case "#/notifications":
        return <Notifications />;
      case "#/settings":
        return <Settings />;
      case "#/admin":
        return isAdmin ? <Admin /> : <Feed />;
      default:
        return <Feed />;
    }
  };

  const isUserSuspended = profile?.status === "suspended" && 
                          profile.suspended_until && 
                          new Date(profile.suspended_until) > new Date();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-colors duration-150">
      
      {/* Impersonation Banner */}
      {impersonatorProfile && (
        <div className="bg-gradient-to-r from-accent to-amber-600 text-background px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-lg z-50">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">🕵️</span>
            <span>
              <strong>Impersonation Mode:</strong> You are currently viewing the system as <strong>{profile?.username}</strong> ({profile?.pending_role}).
            </span>
          </div>
          <Button 
            size="sm" 
            variant="default" 
            onClick={exitImpersonation}
            className="h-7 px-3 text-xs bg-background text-foreground hover:bg-background/90 font-bold border-0 cursor-pointer"
          >
            Exit Impersonation
          </Button>
        </div>
      )}

      {/* Suspension Read-Only Banner */}
      {isUserSuspended && (
        <div className="bg-gradient-to-r from-destructive to-red-700 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-start sm:items-center gap-2 shadow-lg z-50">
          <ShieldAlert className="h-4.5 w-4.5 text-white shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span>
              <strong>Read-Only Mode Active:</strong> Your account is suspended until <strong>{new Date(profile.suspended_until!).toLocaleString()}</strong>. 
              Reason: <em>"{profile.suspension_reason}"</em>. You can view class resources and private DMs, but cannot send posts, replies, files, reports, or rename requests.
            </span>
          </div>
        </div>
      )}
      
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 w-full glass border-b border-border/50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-4">
          
          {/* Logo Title */}
          <a href="#/feed" className="flex items-center gap-2 shrink-0 select-none">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/10">
              <Lock className="h-4 w-4 text-background" />
            </div>
            <span className="font-display font-bold text-lg sm:text-xl text-gradient hidden sm:inline-block">
              ClassVault
            </span>
          </a>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none h-full py-2">
            
            {/* Broadcast Feed Link */}
            <a 
              href="#/feed"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                isActive("#/feed") || isActive("#/")
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
              }`}
            >
              <Radio className="h-4 w-4 shrink-0" />
              <span>Broadcast</span>
            </a>

            {/* Private DMs Link */}
            <a 
              href="#/direct"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                isActive("#/direct")
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
              }`}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span>Direct DMs</span>
            </a>

            {/* Inbox / Warnings Link */}
            <a 
              href="#/notifications"
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                isActive("#/notifications")
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
              }`}
            >
              <Inbox className="h-4 w-4 shrink-0" />
              <span>Inbox</span>
              {unreadWarningsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                </span>
              )}
            </a>

            {/* Settings Link */}
            <a 
              href="#/settings"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                isActive("#/settings")
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
              }`}
            >
              <SettingsIcon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">Settings</span>
            </a>

            {/* Admin Dashboard Link (Conditional) */}
            {isAdmin && (
              <a 
                href="#/admin"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                  isActive("#/admin")
                    ? "bg-accent/15 text-accent border border-accent/30" 
                    : "text-accent/80 hover:text-accent hover:bg-accent/10 border border-transparent"
                }`}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span>Admin</span>
              </a>
            )}
          </nav>

          {/* Right Side User Badge & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto sm:ml-0">
            
            {/* Privacy Status Pill */}
            <a 
              href="#/settings" 
              className="hidden md:flex items-center"
              title="Click to toggle in Settings"
            >
              {profile.anonymous ? (
                <Badge variant="accent" className="flex items-center gap-1 text-[10px] cursor-pointer hover:bg-accent/35 transition-colors">
                  <EyeOff className="h-3 w-3" /> Anonymous Mode
                </Badge>
              ) : (
                <Badge variant="primary" className="flex items-center gap-1 text-[10px] cursor-pointer hover:bg-primary/35 transition-colors">
                  <Eye className="h-3 w-3" /> Public Identity
                </Badge>
              )}
            </a>

            {/* User details */}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">
                {profile.username}
              </span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                {profile.pending_role}
              </span>
            </div>

            {/* Logout button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={signOut}
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        <div className="animate-in fade-in duration-200">
          {renderActiveView()}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-border/20 text-center text-[10px] text-muted-foreground">
        <p>© {new Date().getFullYear()} ClassVault. Secured and encrypted classroom environment.</p>
      </footer>
    </div>
  );
};

// --- App Shell wrapper with Auth & Toast providers ---
export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors theme="dark" closeButton />
      <AppContent />
    </AuthProvider>
  );
}

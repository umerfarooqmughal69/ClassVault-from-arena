import React, { createContext, useContext, useState, useEffect } from "react";
import { dbAPI, AuthSession, Profile } from "@/lib/db";
import { toast } from "sonner";

interface AuthContextType {
  loading: boolean;
  session: AuthSession | null;
  user: { id: string; email: string; username: string } | null;
  profile: Profile | null;
  isAdmin: boolean;
  isOwner: boolean;
  isSuperOwner: boolean;
  impersonatorProfile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  impersonateUser: (targetProfileId: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load initial session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const active = dbAPI.getSession();
        setSession(active);
      } catch (e) {
        console.error("Error loading auth session on mount", e);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Listen to auth changes
    const { unsubscribe } = dbAPI.onAuthStateChange((newSession) => {
      setTimeout(() => {
        setSession(newSession);
        setLoading(false);
      }, 0);
    });

    // ⭐ Listen for database updates to refresh session
    const handleDbUpdate = () => {
      const active = dbAPI.getSession();
      setSession(active);
    };
    
    window.addEventListener("classvault-db-update", handleDbUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("classvault-db-update", handleDbUpdate);
    };
  }, []);

  const refreshProfile = async () => {
    try {
      const active = dbAPI.refreshProfile();
      setSession(active);
    } catch (e) {
      console.error("Error refreshing profile", e);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await dbAPI.signOut();
      toast.success("Signed out successfully!");
    } catch (e: any) {
      toast.error(e.message || "Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  const impersonateUser = async (targetProfileId: string) => {
    setLoading(true);
    try {
      const active = await dbAPI.impersonateUser(targetProfileId);
      setSession(active);
    } catch (e: any) {
      toast.error(e.message || "Failed to impersonate user.");
    } finally {
      setLoading(false);
    }
  };

  const exitImpersonation = async () => {
    setLoading(true);
    try {
      const active = await dbAPI.exitImpersonation();
      setSession(active);
    } catch (e: any) {
      toast.error(e.message || "Failed to exit impersonation.");
    } finally {
      setLoading(false);
    }
  };

  const user = session ? session.user : null;
  const profile = session ? session.profile : null;
  const isAdmin = session ? session.isAdmin : false;
  const isOwner = session ? session.isOwner : false;
  const isSuperOwner = session ? session.isSuperOwner : false;
  const impersonatorProfile = session && session.impersonatingFrom ? session.impersonatingFrom : null;

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user,
        profile,
        isAdmin,
        isOwner,
        isSuperOwner,
        impersonatorProfile,
        refreshProfile,
        signOut: handleSignOut,
        impersonateUser,
        exitImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

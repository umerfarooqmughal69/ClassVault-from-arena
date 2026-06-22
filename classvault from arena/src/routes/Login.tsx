import React, { useState, useEffect } from "react";
import { dbAPI } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { KeyRound, User, Sparkles, Lock, ShieldAlert } from "lucide-react";

export const Login: React.FC = () => {
  // Tab states
  const [activeTab, setActiveTab] = useState("signin");
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [claimUsername, setClaimUsername] = useState("");
  const [claimPassword, setClaimPassword] = useState("");
  const [claimPasswordConfirm, setClaimPasswordConfirm] = useState("");
  
  // Bootstrap states
  const [bootUsername, setBootUsername] = useState("");
  const [bootPassword, setBootPassword] = useState("");
  const [bootPasswordConfirm, setBootPasswordConfirm] = useState("");

  // Check if system needs bootstrap on mount
  const checkBootstrap = async () => {
    try {
      const status = await dbAPI.getBootstrapStatus();
      setNeedsBootstrap(status.needsBootstrap);
    } catch (e) {
      console.error("Failed to check bootstrap status", e);
    }
  };

  useEffect(() => {
    checkBootstrap();
  }, []);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      await dbAPI.signInWithPassword({ 
        username: username.trim(), 
        password 
      });
      toast.success("Welcome back to ClassVault!");
      // Redirect or let App state handle redirect
      window.location.hash = "#/feed";
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Claim Account
  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimUsername.trim() || !claimPassword || !claimPasswordConfirm) {
      toast.error("Please fill in all fields.");
      return;
    }

    if (claimPassword !== claimPasswordConfirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await dbAPI.claimAccount({
        username: claimUsername.trim(),
        password: claimPassword,
      });
      toast.success("Account claimed successfully! You can now sign in.");
      setUsername(claimUsername);
      setPassword("");
      setActiveTab("signin");
      setClaimUsername("");
      setClaimPassword("");
      setClaimPasswordConfirm("");
    } catch (err: any) {
      toast.error(err.message || "Failed to claim account.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Bootstrap
  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootUsername.trim() || !bootPassword || !bootPasswordConfirm) {
      toast.error("Please fill in all fields.");
      return;
    }

    if (bootPassword !== bootPasswordConfirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await dbAPI.bootstrapFirstAdmin({
        username: bootUsername.trim(),
        password: bootPassword,
      });
      toast.success("Administrator account created! Logging you in...");
      
      // Auto login after bootstrap
      await dbAPI.signInWithPassword({
        username: bootUsername.trim(),
        password: bootPassword
      });
      
      window.location.hash = "#/admin";
    } catch (err: any) {
      toast.error(err.message || "Bootstrap failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/10 blur-[80px] -z-10" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 rounded-full bg-accent/5 blur-[100px] -z-10" />

      <div className="w-full max-w-md space-y-6">
        {/* Logo Head */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20 animate-pulse">
            <Lock className="h-6 w-6 text-background" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight font-display text-gradient">
              ClassVault
            </h1>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Anonymous Notes & DMs for your Classroom
            </p>
          </div>
        </div>

        {/* Form Panel */}
        <div className="glass rounded-xl p-6 border border-border/50 shadow-2xl relative overflow-hidden">
          {needsBootstrap ? (
            /* BOOTSTRAP FLOW */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <Badge variant="destructive" className="mx-auto flex w-fit items-center gap-1">
                  <ShieldAlert className="h-3 w-3" /> System Setup Needed
                </Badge>
                <h2 className="text-xl font-semibold text-foreground mt-2">Create Classroom Admin</h2>
                <p className="text-xs text-muted-foreground">
                  Welcome to ClassVault. No administrator accounts were found. Create the very first administrator account to start managing your classroom.
                </p>
              </div>

              <form onSubmit={handleBootstrap} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Admin Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={bootUsername}
                      onChange={(e) => setBootUsername(e.target.value)}
                      placeholder="e.g. admin_pro"
                      required
                      className="w-full text-sm rounded-md border border-border bg-input pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={bootPassword}
                      onChange={(e) => setBootPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full text-sm rounded-md border border-border bg-input pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={bootPasswordConfirm}
                      onChange={(e) => setBootPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full text-sm rounded-md border border-border bg-input pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full mt-4 cursor-pointer"
                  variant="accent"
                  disabled={isLoading}
                >
                  {isLoading ? "Setting up..." : "Initialize System Admin"}
                </Button>
              </form>
            </div>
          ) : (
            /* REGULAR LOGIN/CLAIM TABS */
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="claim">Claim Account</TabsTrigger>
              </TabsList>

              {/* SIGN IN TAB */}
              <TabsContent value="signin" className="space-y-4 focus-visible:ring-0">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-semibold text-foreground">Welcome Back</h2>
                  <p className="text-xs text-muted-foreground">
                    Log in with your pre-created classroom username.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-3.5 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Class Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. alice"
                        required
                        className="w-full text-sm rounded-md border border-border bg-input pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full text-sm rounded-md border border-border bg-input pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full mt-4 cursor-pointer"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In to Vault"}
                  </Button>
                </form>
              </TabsContent>

              {/* CLAIM ACCOUNT TAB */}
              <TabsContent value="claim" className="space-y-4 focus-visible:ring-0">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-semibold text-foreground flex items-center justify-center gap-1.5">
                    <Sparkles className="h-5 w-5 text-accent" /> Claim Your Space
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Did the teacher create your username? Set your own password to claim it!
                  </p>
                </div>

                <form onSubmit={handleClaim} className="space-y-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Assigned Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={claimUsername}
                        onChange={(e) => setClaimUsername(e.target.value)}
                        placeholder="Provided by classroom admin"
                        required
                        className="w-full text-sm rounded-md border border-border bg-input pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Set Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        type="password"
                        value={claimPassword}
                        onChange={(e) => setClaimPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        required
                        className="w-full text-sm rounded-md border border-border bg-input pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        type="password"
                        value={claimPasswordConfirm}
                        onChange={(e) => setClaimPasswordConfirm(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full text-sm rounded-md border border-border bg-input pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full mt-4 cursor-pointer"
                    variant="accent"
                    disabled={isLoading}
                  >
                    {isLoading ? "Activating..." : "Claim Student Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Private note */}
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground max-w-xs mx-auto">
            ClassVault enforces complete privacy. All students are anonymous to peers by default. Admins pre-create accounts; no personal information is ever collected.
          </p>
        </div>
      </div>
    </div>
  );
};

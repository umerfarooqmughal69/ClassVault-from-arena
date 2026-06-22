import React, { useState } from "react";
import { dbAPI } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings as SettingsIcon, Shield, User, KeyRound, EyeOff, ShieldAlert } from "lucide-react";

export const Settings: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  
  // Privacy State
  const [anonymous, setAnonymous] = useState(profile?.anonymous ?? true);
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

  // Username Change State
  const [requestedUsername, setRequestedUsername] = useState("");
  const [isSubmittingUsername, setIsSubmittingUsername] = useState(false);

  // Password Change State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Handle Privacy Toggle
  const handlePrivacyChange = async (checked: boolean) => {
    setIsUpdatingPrivacy(true);
    try {
      await dbAPI.setAnonymous({ anonymous: checked });
      setAnonymous(checked);
      toast.success(
        checked 
          ? "Anonymous Mode enabled. Your name is now hidden from classmates." 
          : "Anonymous Mode disabled. Classmates can now see your username."
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to update privacy settings.");
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  // Handle Username Request
  const handleUsernameRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedUsername.trim()) {
      toast.error("Please enter a username.");
      return;
    }

    setIsSubmittingUsername(true);
    try {
      await dbAPI.requestUsernameChange({ requested: requestedUsername.trim() });
      toast.success(`Request to change username to "${requestedUsername}" submitted for review.`);
      setRequestedUsername("");
      refreshProfile(); // refresh requests list or notifications
    } catch (e: any) {
      toast.error(e.message || "Failed to submit username request.");
    } finally {
      setIsSubmittingUsername(false);
    }
  };

  // Handle Password Change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsSubmittingPassword(true);
    try {
      await dbAPI.changePassword({ newPassword });
      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Failed to update password.");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-1 sm:px-4 py-2 select-none">
      
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your account privacy, request a username change, or update your password.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left/Main Column: Privacy & Username (Takes 2/3 cols) */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Privacy Settings */}
          <div className="glass rounded-xl border border-border/50 p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/40 pb-2.5">
              <Shield className="h-4.5 w-4.5 text-primary" /> Account Privacy
            </h2>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-md">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">Anonymous Mode</span>
                  {anonymous ? (
                    <Badge variant="accent" className="flex items-center gap-0.5 text-[10px] py-0 px-1.5">
                      <EyeOff className="h-2.5 w-2.5" /> Hidden from peers
                    </Badge>
                  ) : (
                    <Badge variant="primary" className="text-[10px] py-0 px-1.5">
                      Public Identity
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When enabled, classmates will see "Anonymous" instead of your username on all broadcasts, replies, and private DMs.
                </p>
              </div>
              <Switch
                checked={anonymous}
                onCheckedChange={handlePrivacyChange}
                disabled={isUpdatingPrivacy}
              />
            </div>

            <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 flex items-start gap-2.5 text-xs text-warning/90">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Moderation Notice:</strong> Toggling Anonymous Mode hides your identity from fellow students, but <strong>classroom administrators can always see your real username</strong> on all posts for safety and accountability.
              </p>
            </div>
          </div>

          {/* Request Username Change */}
          <div className="glass rounded-xl border border-border/50 p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/40 pb-2.5">
              <User className="h-4.5 w-4.5 text-primary" /> Request Username Change
            </h2>

            <p className="text-xs text-muted-foreground leading-relaxed">
              If you want to rename your account, you must submit a request. An administrator must approve it before it takes effect. Keep in mind:
            </p>
            
            <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
              <li>Usernames must be 2 to 32 characters long.</li>
              <li>Only alphanumeric characters, dashes (-), and underscores (_) are allowed.</li>
              <li>Your previous username will be freed for others to claim once approved.</li>
            </ul>

            <form onSubmit={handleUsernameRequest} className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={requestedUsername}
                  onChange={(e) => setRequestedUsername(e.target.value)}
                  placeholder="Enter new username..."
                  required
                  disabled={isSubmittingUsername}
                  className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="cursor-pointer text-xs h-10"
                disabled={isSubmittingUsername || !requestedUsername.trim()}
              >
                {isSubmittingUsername ? "Submitting..." : "Request Rename"}
              </Button>
            </form>
          </div>
        </div>

        {/* Right Column: Password Update (Takes 1/3 col) */}
        <div className="space-y-6">
          
          {/* Security / Password */}
          <div className="glass rounded-xl border border-border/50 p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border/40 pb-2.5">
              <KeyRound className="h-4.5 w-4.5 text-primary" /> Update Password
            </h2>

            <form onSubmit={handlePasswordChange} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  disabled={isSubmittingPassword}
                  className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isSubmittingPassword}
                  className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>

              <Button
                type="submit"
                className="w-full cursor-pointer text-xs"
                disabled={isSubmittingPassword || !newPassword || !confirmPassword}
              >
                {isSubmittingPassword ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

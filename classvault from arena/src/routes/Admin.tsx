import React, { useState, useEffect, useCallback } from "react";
import { 
  dbAPI, 
  Profile, 
  Message, 
  Report, 
  UsernameRequest, 
  AppSetting, 
  AppRole,
  AdminActivityLog,
  AdminPermission,
  ALL_PERMISSION_KEYS,
  PermissionKey
} from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Shield, Users, MessageSquare, AlertTriangle, UserCheck, Settings as SettingsIcon,
  Plus, AlertCircle, ShieldAlert, UserMinus, ShieldCheck, Edit, RefreshCw, EyeOff,
  Activity, Eye, CheckSquare, Square
} from "lucide-react";
import { toast } from "sonner";

// Grouping definitions for checkbox permissions UI
const PERMISSION_GROUPS = [
  {
    title: "User Management",
    keys: ["create_students", "edit_students", "suspend_students", "unsuspend_students", "remove_students", "send_warnings"] as PermissionKey[]
  },
  {
    title: "Content Moderation",
    keys: ["view_broadcasts", "view_direct_messages", "delete_messages", "handle_reports", "resolve_reports"] as PermissionKey[]
  },
  {
    title: "Username Requests",
    keys: ["approve_username_requests", "reject_username_requests"] as PermissionKey[]
  },
  {
    title: "Privacy Controls",
    keys: ["view_anonymous_identities"] as PermissionKey[]
  },
  {
    title: "System / Feature Controls",
    keys: ["manage_feature_toggles"] as PermissionKey[]
  },
  {
    title: "Analytics / Data",
    keys: ["view_analytics", "export_data"] as PermissionKey[]
  },
  {
    title: "Admin Management",
    keys: ["create_admins"] as PermissionKey[]
  }
];

export const Admin: React.FC = () => {
  const { profile, isOwner, isSuperOwner, impersonateUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState("overview");
  
  // Data States
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [requests, setRequests] = useState<UsernameRequest[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);
  const [adminPermissions, setAdminPermissions] = useState<AdminPermission[]>([]);
  
  // Permission cache for standard admin viewing features
  const [myPermissions, setMyPermissions] = useState<Record<string, boolean>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Form States - Create Account
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("student");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  
  // Custom permissions for the admin being created
  const [createPermissions, setCreatePermissions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ALL_PERMISSION_KEYS.forEach(key => {
      initial[key] = true;
    });
    return initial;
  });

  // Dialog States - Moderation
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  
  // Warning Dialog
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isSubmittingWarning, setIsSubmittingWarning] = useState(false);

  // Suspension Dialog
  const [suspensionOpen, setSuspensionOpen] = useState(false);
  const [suspendDays, setSuspendDays] = useState("3");
  const [suspendReason, setSuspendReason] = useState("");
  const [isSubmittingSuspension, setIsSubmittingSuspension] = useState(false);

  // Rename Dialog
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameUsername, setRenameUsername] = useState("");
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  // Resolve Request Dialog
  const [selectedRequest, setSelectedRequest] = useState<UsernameRequest | null>(null);
  const [requestApprove, setRequestApprove] = useState(true);
  const [requestNote, setRequestNote] = useState("");
  const [isSubmittingRequestResolution, setIsSubmittingRequestResolution] = useState(false);

  // Edit Permissions Dialog (Owner/Super Owner only)
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [targetAdminProfile, setTargetAdminProfile] = useState<Profile | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<Record<string, boolean>>({});
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Helper to check standard admin permission in local state
  const hasLocalPermission = (key: PermissionKey): boolean => {
    if (isOwner) return true;
    return myPermissions[key] === true;
  };

  // ⭐ FIXED: loadAdminData with proper state updates
  const loadAdminData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    
    try {
      // 1. Fetch standard datasets
      const pData = await dbAPI.getAdminProfiles();
      const sData = await dbAPI.getSettings();

      // 2. Conditional data loading based on permissions or Owner status
      let mData: Message[] = [];
      let rData: Report[] = [];
      let reqData: UsernameRequest[] = [];
      let logsData: AdminActivityLog[] = [];
      let permissionsData: AdminPermission[] = [];

      // Check current user's local permissions (caches for UI control)
      if (profile) {
        const cache: Record<string, boolean> = {};
        for (const key of ALL_PERMISSION_KEYS) {
          cache[key] = await dbAPI.hasPermission(profile.id, key);
        }
        setMyPermissions(cache);

        // Load Messages if allowed
        if (isOwner || cache["view_broadcasts"] || cache["view_direct_messages"]) {
          mData = await dbAPI.getAdminMessages();
        }

        // Load Reports if allowed
        if (isOwner || cache["handle_reports"]) {
          rData = await dbAPI.getAdminReports();
        }

        // Load Username requests if allowed
        if (isOwner || cache["approve_username_requests"] || cache["reject_username_requests"]) {
          reqData = await dbAPI.getAdminUsernameRequests();
        }
      }

      // 3. Owner-only dataset queries
      if (isOwner) {
        logsData = await dbAPI.getAdminActivityLogs();
        permissionsData = dbAPI.getAdminPermissions();
      }

      // ⭐ FIXED: Use spread operators to create new array references
      setProfiles([...pData]);
      setMessages([...mData]);
      setReports([...rData]);
      setRequests([...reqData]);
      setSettings([...sData]);
      setActivityLogs([...logsData]);
      setAdminPermissions([...permissionsData]);
    } catch (e: any) {
      console.error("Failed to load admin data", e);
      toast.error("Error loading administration data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [profile, isOwner]);

  useEffect(() => {
    loadAdminData();
    
    // Listen for global database update events for instant, automatic updates
    const handleDbUpdate = () => {
      loadAdminData(true);
    };
    
    window.addEventListener("classvault-db-update", handleDbUpdate);
    
    // Auto-poll messages & reports every 10 seconds as a backup
    const interval = setInterval(() => {
      loadAdminData(true);
    }, 10000);

    return () => {
      window.removeEventListener("classvault-db-update", handleDbUpdate);
      clearInterval(interval);
    };
  }, [loadAdminData]);

  // Handle Feature Flag Toggle / Emergency Locks
  const handleSettingToggle = async (key: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      await dbAPI.setSetting({ key, value: newValue });
      
      // Update state locally
      setSettings(prev => 
        prev.map(s => s.key === key ? { ...s, value: newValue, updated_at: new Date().toISOString() } : s)
      );
      
      // ⭐ Force refresh after toggle
      await loadAdminData(true);
      
      toast.success(`Feature "${key.replace(/_/g, " ")}" updated successfully.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update classroom setting.");
    }
  };

  // Get Setting Helper
  const getSettingValue = (key: string) => {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value === true : (key === "platform_full_lock" ? false : true);
  };

  // Create Student/Admin Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      toast.error("Please enter a username.");
      return;
    }

    setIsCreatingAccount(true);
    try {
      await dbAPI.createAccount({
        username: newUsername.trim(),
        role: newRole,
        permissions: (newRole === 'admin' || newRole === 'owner') && isOwner ? createPermissions : undefined
      });
      toast.success(`Account for "${newUsername.trim()}" pre-created successfully!`);
      setNewUsername("");
      
      // Reset createPermissions state
      setCreatePermissions(() => {
        const initial: Record<string, boolean> = {};
        ALL_PERMISSION_KEYS.forEach(key => {
          initial[key] = true;
        });
        return initial;
      });
      
      // ⭐ Force refresh after creating
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to create account.");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  // Remove / Soft Delete Student Account
  const handleRemoveAccount = async (profileId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to soft-remove "${username}"? They will lose access immediately but their profile is restorable by Owners.`)) {
      return;
    }

    try {
      await dbAPI.removeAccount({ profileId });
      toast.success(`Student "${username}" has been soft-removed.`);
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to remove account.");
    }
  };

  // Restore Soft-Deleted Account (Owner Override feature)
  const handleRestoreAccount = async (username: string, role: AppRole) => {
    try {
      await dbAPI.createAccount({ username, role });
      toast.success(`Student account "${username}" restored successfully!`);
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to restore account.");
    }
  };

  // Unsuspend Account
  const handleUnsuspend = async (profileId: string, username: string) => {
    try {
      await dbAPI.unsuspendAccount({ profileId });
      toast.success(`Suspension lifted for "${username}".`);
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to lift suspension.");
    }
  };

  // Submit Warning
  const handleSubmitWarning = async () => {
    if (!selectedProfile || !warningMessage.trim()) return;
    setIsSubmittingWarning(true);
    try {
      await dbAPI.warnAccount({
        profileId: selectedProfile.id,
        message: warningMessage.trim()
      });
      toast.success(`Warning notice sent to "${selectedProfile.username}".`);
      setWarningOpen(false);
      setWarningMessage("");
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to send warning.");
    } finally {
      setIsSubmittingWarning(false);
    }
  };

  // Submit Suspension
  const handleSubmitSuspension = async () => {
    if (!selectedProfile) return;
    setIsSubmittingSuspension(true);
    try {
      const daysNum = parseInt(suspendDays);
      await dbAPI.suspendAccount({
        profileId: selectedProfile.id,
        days: daysNum,
        reason: suspendReason.trim() || "Suspended by classroom administrator."
      });
      toast.success(`Student "${selectedProfile.username}" suspended for ${daysNum} days.`);
      setSuspensionOpen(false);
      setSuspendReason("");
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to suspend account.");
    } finally {
      setIsSubmittingSuspension(false);
    }
  };

  // Submit Force Rename
  const handleSubmitRename = async () => {
    if (!selectedProfile || !renameUsername.trim()) return;
    setIsSubmittingRename(true);
    try {
      await dbAPI.changeUsername({
        profileId: selectedProfile.id,
        newUsername: renameUsername.trim()
      });
      toast.success(`Student renamed to "${renameUsername.trim()}".`);
      setRenameOpen(false);
      setRenameUsername("");
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to rename student.");
    } finally {
      setIsSubmittingRename(false);
    }
  };

  // Submit Username Change Resolution
  const handleSubmitRequestResolution = async () => {
    if (!selectedRequest) return;
    setIsSubmittingRequestResolution(true);
    try {
      await dbAPI.resolveUsernameRequest({
        requestId: selectedRequest.id,
        approve: requestApprove,
        note: requestNote.trim() || null
      });
      
      toast.success(
        requestApprove 
          ? `Request approved. Student renamed to "${selectedRequest.requested_username}".` 
          : "Rename request rejected."
      );
      setSelectedRequest(null);
      setRequestNote("");
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to resolve request.");
    } finally {
      setIsSubmittingRequestResolution(false);
    }
  };

  // Open Edit Permissions Dialog
  const handleOpenPermissions = (adminProf: Profile) => {
    setTargetAdminProfile(adminProf);
    
    const record: Record<string, boolean> = {};
    ALL_PERMISSION_KEYS.forEach(key => {
      const rule = adminPermissions.find(p => p.admin_id === adminProf.id && p.permission_key === key);
      record[key] = rule ? rule.allowed === true : false;
    });
    
    setEditedPermissions(record);
    setPermissionsOpen(true);
  };

  const handleGroupToggle = (groupTitle: string, currentStatus: boolean) => {
    const group = PERMISSION_GROUPS.find(g => g.title === groupTitle);
    if (!group) return;

    setEditedPermissions(prev => {
      const updated = { ...prev };
      group.keys.forEach(key => {
        updated[key] = !currentStatus;
      });
      return updated;
    });
  };

  const handlePermissionCheckboxToggle = (key: PermissionKey) => {
    setEditedPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isGroupFullyChecked = (groupTitle: string): boolean => {
    const group = PERMISSION_GROUPS.find(g => g.title === groupTitle);
    if (!group) return false;
    return group.keys.every(key => editedPermissions[key] === true);
  };

  const handleSavePermissions = async () => {
    if (!targetAdminProfile) return;
    setIsSavingPermissions(true);
    try {
      await dbAPI.updateAdminPermissions({
        adminId: targetAdminProfile.id,
        permissions: editedPermissions
      });
      toast.success(`Permissions updated for administrator "${targetAdminProfile.username}".`);
      setPermissionsOpen(false);
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to save permissions.");
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Resolve Report
  const handleResolveReport = async (reportId: string) => {
    try {
      await dbAPI.resolveReport({ reportId });
      toast.success("Report marked as resolved.");
      await loadAdminData(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to resolve report.");
    }
  };

  // Impersonate student or administrator
  const handleImpersonation = async (targetId: string, username: string) => {
    try {
      await impersonateUser(targetId);
    } catch (e: any) {
      toast.error(e.message || `Failed to impersonate "${username}"`);
    }
  };

  // Statistics calculations
  const stats = {
    totalAccounts: profiles.length,
    activeAccounts: profiles.filter(p => p.status === "active").length,
    suspendedAccounts: profiles.filter(p => p.status === "suspended").length,
    removedAccounts: profiles.filter(p => p.status === "removed").length,
    openReports: reports.filter(r => r.status === "open").length,
    pendingRequests: requests.filter(r => r.status === "pending").length,
    unclaimedAccounts: profiles.filter(p => !p.password_set && p.status !== "removed").length,
    totalAdmins: profiles.filter(p => p.pending_role === "admin").length,
  };

  // Tab permissions check
  const showAccountsTab = isOwner || hasLocalPermission("create_students") || hasLocalPermission("suspend_students") || hasLocalPermission("remove_students");
  const showMessagesTab = isOwner || hasLocalPermission("view_broadcasts") || hasLocalPermission("view_direct_messages");
  const showReportsTab = isOwner || hasLocalPermission("handle_reports");
  const showRequestsTab = isOwner || hasLocalPermission("approve_username_requests") || hasLocalPermission("reject_username_requests");
  const showSettingsTab = isOwner || hasLocalPermission("manage_feature_toggles");
  const showLogsTab = isOwner;

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-1 sm:px-4 py-2 select-none animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" /> 
            {isOwner ? "Owner Control Panel" : "Classroom Control Center"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isOwner 
              ? "Supervise administrators, manage custom permissions, oversee active streams, and handle system-wide emergency locks."
              : "Manage student accounts, review flagged reports, respond to rename requests, and configure classroom features."}
          </p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => loadAdminData(true)}
          disabled={isRefreshing || isLoading}
          className="cursor-pointer gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Syncing..." : "Sync Panel"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <RefreshCw className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Hydrating control panels...</p>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          
          <TabsList className="flex flex-wrap h-auto bg-muted p-1 rounded-md mb-6 w-full justify-start overflow-x-auto select-none gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-1.5 py-2">
              <Shield className="h-4 w-4" /> Overview
            </TabsTrigger>
            
            {showAccountsTab && (
              <TabsTrigger value="accounts" className="flex items-center gap-1.5 py-2">
                <Users className="h-4 w-4" /> Accounts ({stats.unclaimedAccounts} unclaimed)
              </TabsTrigger>
            )}
            
            {showMessagesTab && (
              <TabsTrigger value="messages" className="flex items-center gap-1.5 py-2">
                <MessageSquare className="h-4 w-4" /> Messages
              </TabsTrigger>
            )}
            
            {showReportsTab && (
              <TabsTrigger value="reports" className="flex items-center gap-1.5 py-2">
                <AlertTriangle className="h-4 w-4" /> Reports 
                {stats.openReports > 0 && <span className="ml-1 bg-destructive text-white text-[10px] px-1.5 py-0.5 rounded-full animate-bounce">{stats.openReports}</span>}
              </TabsTrigger>
            )}
            
            {showRequestsTab && (
              <TabsTrigger value="requests" className="flex items-center gap-1.5 py-2">
                <UserCheck className="h-4 w-4" /> Requests
                {stats.pendingRequests > 0 && <span className="ml-1 bg-primary text-background text-[10px] px-1.5 py-0.5 rounded-full">{stats.pendingRequests}</span>}
              </TabsTrigger>
            )}
            
            {showSettingsTab && (
              <TabsTrigger value="settings" className="flex items-center gap-1.5 py-2">
                <SettingsIcon className="h-4 w-4" /> Settings
              </TabsTrigger>
            )}

            {showLogsTab && (
              <TabsTrigger value="logs" className="flex items-center gap-1.5 py-2">
                <Activity className="h-4 w-4" /> Audit Logs
              </TabsTrigger>
            )}
          </TabsList>

          {/* 1. OVERVIEW TAB */}
          <TabsContent value="overview" className="focus-visible:ring-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="glass rounded-xl p-4 border-l-4 border-l-primary flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Accounts</p>
                  <p className="text-2xl font-bold text-foreground">{stats.totalAccounts}</p>
                </div>
                <Users className="h-8 w-8 text-primary/40 shrink-0" />
              </div>

              <div className="glass rounded-xl p-4 border-l-4 border-l-success flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Students</p>
                  <p className="text-2xl font-bold text-foreground">{stats.activeAccounts}</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-success/40 shrink-0" />
              </div>

              <div className="glass rounded-xl p-4 border-l-4 border-l-warning flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suspended / RO</p>
                  <p className="text-2xl font-bold text-foreground">{stats.suspendedAccounts}</p>
                </div>
                <ShieldAlert className="h-8 w-8 text-warning/40 shrink-0" />
              </div>

              {isOwner ? (
                <div className="glass rounded-xl p-4 border-l-4 border-l-accent flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Admins</p>
                    <p className="text-2xl font-bold text-foreground">{stats.totalAdmins}</p>
                  </div>
                  <Shield className="h-8 w-8 text-accent/40 shrink-0" />
                </div>
              ) : (
                <div className="glass rounded-xl p-4 border-l-4 border-l-destructive flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Open Reports</p>
                    <p className="text-2xl font-bold text-foreground">{stats.openReports}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-destructive/40 shrink-0" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Quick Account Creation Form */}
              {(isOwner || hasLocalPermission("create_students")) && (
                <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
                  <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-2 flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-primary" /> Pre-create Classroom Credentials
                  </h3>
                  
                  <form onSubmit={handleCreateAccount} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Class Username
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g. jason_k"
                        required
                        className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Role Designation
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                          <input
                            type="radio"
                            name="newRole"
                            value="student"
                            checked={newRole === "student"}
                            onChange={() => setNewRole("student")}
                            className="text-primary focus:ring-primary h-4 w-4 bg-transparent border-border"
                          />
                          Student Directory
                        </label>

                        {(isOwner || hasLocalPermission("create_admins")) && (
                          <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                            <input
                              type="radio"
                              name="newRole"
                              value="admin"
                              checked={newRole === "admin"}
                              onChange={() => setNewRole("admin")}
                              className="text-primary focus:ring-primary h-4 w-4 bg-transparent border-border"
                            />
                            Administrator
                          </label>
                        )}

                        {isSuperOwner && (
                          <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                            <input
                              type="radio"
                              name="newRole"
                              value="owner"
                              checked={newRole === "owner"}
                              onChange={() => setNewRole("owner")}
                              className="text-primary focus:ring-primary h-4 w-4 bg-transparent border-border"
                            />
                            Owner
                          </label>
                        )}
                      </div>
                    </div>

                    {(newRole === 'admin' || newRole === 'owner') && isOwner && (
                      <div className="space-y-3 pt-2 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5" /> Initialize Custom Permissions
                          </span>
                          <span className="text-[9px] text-muted-foreground italic">(Customize access rules below)</span>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-3 p-2.5 rounded-lg border border-border bg-input/40">
                          {PERMISSION_GROUPS.map((group) => {
                            const isGroupChecked = group.keys.every(key => createPermissions[key] === true);
                            
                            return (
                              <div key={group.title} className="space-y-1.5 border-b border-border/20 last:border-0 pb-2 last:pb-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreatePermissions(prev => {
                                      const updated = { ...prev };
                                      group.keys.forEach(key => {
                                        updated[key] = !isGroupChecked;
                                      });
                                      return updated;
                                    });
                                  }}
                                  className="flex items-center gap-1.5 font-bold text-[10px] text-primary uppercase tracking-wider cursor-pointer w-full text-left select-none"
                                >
                                  {isGroupChecked ? (
                                    <CheckSquare className="h-3.5 w-3.5 shrink-0" />
                                  ) : (
                                    <Square className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                                  )}
                                  {group.title}
                                </button>

                                <div className="grid grid-cols-2 gap-2 pl-4 pt-0.5">
                                  {group.keys.map((key) => {
                                    const isChecked = createPermissions[key] === true;
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                          setCreatePermissions(prev => ({
                                            ...prev,
                                            [key]: !prev[key]
                                          }));
                                        }}
                                        className="flex items-center gap-1.5 text-[10px] text-foreground/90 hover:text-foreground cursor-pointer text-left select-none"
                                      >
                                        {isChecked ? (
                                          <CheckSquare className="h-3 w-3 text-primary shrink-0" />
                                        ) : (
                                          <Square className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                        )}
                                        <span className="capitalize truncate">{key.replace(/_/g, " ")}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <Button type="submit" disabled={isCreatingAccount} className="w-full cursor-pointer text-xs h-9">
                      {isCreatingAccount ? "Creating..." : "Pre-create & Issue Credentials"}
                    </Button>
                  </form>
                </div>
              )}

              {/* Classroom Control Toggles */}
              <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
                <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-2">
                  System Locks & Toggles Status
                </h3>
                
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Emergency Platform Lock</p>
                      <p className="text-[10px] text-muted-foreground">Freezes all classroom posting in Read-Only mode</p>
                    </div>
                    <Badge variant={getSettingValue("platform_full_lock") ? "destructive" : "success"} className="animate-pulse">
                      {getSettingValue("platform_full_lock") ? "ENGAGED" : "Normal"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Class Broadcast Feed</p>
                      <p className="text-[10px] text-muted-foreground">Allows students to post on the public bulletin board</p>
                    </div>
                    <Badge variant={getSettingValue("broadcast_enabled") ? "success" : "destructive"}>
                      {getSettingValue("broadcast_enabled") ? "Active" : "Disabled"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Private DMs</p>
                      <p className="text-[10px] text-muted-foreground">Allows private peer-to-peer messaging</p>
                    </div>
                    <Badge variant={getSettingValue("direct_messages_enabled") ? "success" : "destructive"}>
                      {getSettingValue("direct_messages_enabled") ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 2. ACCOUNTS TAB */}
          {showAccountsTab && (
            <TabsContent value="accounts" className="focus-visible:ring-0 space-y-4">
              
              {(isOwner || hasLocalPermission("create_students")) && (
                <div className="glass rounded-xl p-4 border border-border/50 flex flex-col md:flex-row items-end gap-4">
                  <div className="flex-1 space-y-1 w-full">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pre-create Account</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Enter username (e.g. lucas_m)..."
                      className="w-full text-xs rounded-md border border-border bg-input px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1 w-full md:w-48">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Role</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as AppRole)}
                      className="w-full text-xs rounded-md border border-border bg-input px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-8"
                    >
                      <option value="student">Student</option>
                      {(isOwner || hasLocalPermission("create_admins")) && <option value="admin">Administrator</option>}
                      {isSuperOwner && <option value="owner">Owner</option>}
                    </select>
                  </div>
                  <Button onClick={handleCreateAccount} disabled={isCreatingAccount} className="cursor-pointer text-xs h-8 shrink-0 w-full md:w-auto">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Pre-create
                  </Button>
                </div>
              )}

              <div className="glass rounded-xl border border-border/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground font-semibold">
                        <th className="p-3">Username</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Registration Status</th>
                        <th className="p-3">Suspension / Warning Info</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/35">
                      {profiles.map((p) => {
                        const isUnclaimed = !p.password_set && p.status !== "removed";
                        const isSuspended = p.status === "suspended";
                        const isRemoved = p.status === "removed";
                        
                        const showImpersonate = isOwner && p.pending_role !== 'owner' && p.pending_role !== 'super_owner' && p.status !== 'removed';
                        const showEditPermissions = (isSuperOwner && (p.pending_role === 'owner' || p.pending_role === 'admin')) ||
                                                     (isOwner && !isSuperOwner && p.pending_role === 'admin');
                        const showRestore = isOwner && isRemoved;
                        
                        return (
                          <tr key={p.id} className={`hover:bg-muted/10 transition-colors ${isRemoved ? "opacity-40" : ""}`}>
                            <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                              {p.username}
                              {p.pending_role === 'super_owner' && <Badge variant="destructive" className="text-[8px] tracking-wider py-0 px-1 font-mono">SUPER</Badge>}
                            </td>
                            <td className="p-3">
                              <Badge variant={['owner', 'super_owner'].includes(p.pending_role) ? "accent" : p.pending_role === 'admin' ? "primary" : "secondary"} className="text-[10px] capitalize">
                                {p.pending_role.replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {isRemoved ? (
                                <Badge variant="destructive" className="text-[10px]">Removed / Deleted</Badge>
                              ) : isUnclaimed ? (
                                <Badge variant="outline" className="text-[10px] text-accent border-accent/30 bg-accent/5">Unclaimed</Badge>
                              ) : isSuspended ? (
                                <Badge variant="warning" className="text-[10px]">Suspended (R-O)</Badge>
                              ) : (
                                <Badge variant="success" className="text-[10px]">Active</Badge>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground text-[11px] max-w-xs truncate">
                              {isSuspended ? (
                                <span className="text-warning font-semibold">
                                  RO until {new Date(p.suspended_until!).toLocaleDateString()}: {p.suspension_reason}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="p-3 text-right space-x-1 sm:space-x-1.5">
                              {showRestore && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-success hover:bg-success/10 border-success/30 cursor-pointer text-[10px]"
                                  onClick={() => handleRestoreAccount(p.username, p.pending_role)}
                                >
                                  Restore Account
                                </Button>
                              )}

                              {!isRemoved && (
                                <>
                                  {showImpersonate && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-accent hover:bg-accent/10 cursor-pointer"
                                      onClick={() => handleImpersonation(p.id, p.username)}
                                      title="Act As User (Impersonation Mode)"
                                    >
                                      Act As
                                    </Button>
                                  )}

                                  {showEditPermissions && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-primary hover:bg-primary/10 cursor-pointer font-semibold"
                                      onClick={() => handleOpenPermissions(p)}
                                      title="Edit Admin Permissions"
                                    >
                                      Permissions
                                    </Button>
                                  )}

                                  {(isOwner || hasLocalPermission("send_warnings")) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-primary hover:bg-primary/10 cursor-pointer"
                                      onClick={() => {
                                        setSelectedProfile(p);
                                        setWarningMessage("");
                                        setWarningOpen(true);
                                      }}
                                    >
                                      Warn
                                    </Button>
                                  )}

                                  {isSuspended ? (
                                    (isOwner || hasLocalPermission("unsuspend_students")) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-success hover:bg-success/10 cursor-pointer font-semibold"
                                        onClick={() => handleUnsuspend(p.id, p.username)}
                                      >
                                        Unsuspend
                                      </Button>
                                    )
                                  ) : (
                                    (isOwner || hasLocalPermission("suspend_students")) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-warning hover:bg-warning/10 cursor-pointer"
                                        onClick={() => {
                                          setSelectedProfile(p);
                                          setSuspendReason("");
                                          setSuspendDays("3");
                                          setSuspensionOpen(true);
                                        }}
                                      >
                                        Suspend
                                      </Button>
                                    )
                                  )}

                                  {(isOwner || hasLocalPermission("edit_students")) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-foreground hover:bg-muted cursor-pointer"
                                      onClick={() => {
                                        setSelectedProfile(p);
                                        setRenameUsername(p.username);
                                        setRenameOpen(true);
                                      }}
                                    >
                                      Rename
                                    </Button>
                                  )}

                                  {(isOwner || hasLocalPermission("remove_students")) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-destructive hover:bg-destructive/15 cursor-pointer"
                                      onClick={() => handleRemoveAccount(p.id, p.username)}
                                    >
                                      Remove
                                    </Button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          )}

          {/* 3. MESSAGES TAB */}
          {showMessagesTab && (
            <TabsContent value="messages" className="focus-visible:ring-0 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                  Classroom Master Message Feed
                </h2>
                {hasLocalPermission("view_anonymous_identities") ? (
                  <span className="text-[10px] text-accent font-semibold bg-accent/5 px-2.5 py-1 rounded border border-accent/20 flex items-center gap-1 animate-pulse">
                    <Eye className="h-3.5 w-3.5" /> Privacy decryption active: Administrators see real usernames.
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2.5 py-1 rounded border border-border">
                    🔒 Standard privacy active: Anonymous identities remain hidden.
                  </span>
                )}
              </div>

              <div className="space-y-3.5">
                {messages.length > 0 ? (
                  messages.map((m) => {
                    const isDecrypted = m.sender_anonymous && m.sender_username !== "Anonymous";
                    
                    return (
                      <div key={m.id} className="relative group">
                        <div className="glass rounded-lg p-4 border border-border/50 space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-foreground">{m.sender_username}</span>
                            
                            {m.sender_anonymous && (
                              <Badge variant="accent" className="text-[9px] py-0 px-1.5 flex items-center gap-0.5">
                                <EyeOff className="h-2 w-2" /> Posted Anonymously
                              </Badge>
                            )}

                            {isDecrypted && (
                              <Badge variant="destructive" className="text-[9px] py-0 px-1.5 font-semibold">
                                Decrypted Identity
                              </Badge>
                            )}
                            
                            <span className="text-muted-foreground text-[10px]">
                              {new Date(m.created_at).toLocaleString()}
                            </span>

                            <span className="text-muted-foreground text-[10px] ml-auto">
                              {m.recipient_id ? `Private DM` : "Class Broadcast"}
                            </span>
                          </div>
                          
                          <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {m.content}
                          </p>

                          {m.file_name && (
                            <div className="text-[10px] text-primary flex items-center gap-1 bg-primary/5 px-2 py-1 rounded w-fit border border-primary/20">
                              <Plus className="h-3 w-3" /> Attached File: {m.file_name} ({Math.round((m.file_size || 0) / 1024)} KB)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="glass rounded-lg p-12 text-center border-dashed border border-border/60">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="text-sm font-semibold text-foreground">No messages logged</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Messages will appear here once students post broadcasts or DMs.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* 4. REPORTS TAB */}
          {showReportsTab && (
            <TabsContent value="reports" className="focus-visible:ring-0 space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                Active Moderation Flags ({stats.openReports} open)
              </h2>

              <div className="space-y-3.5">
                {reports.length > 0 ? (
                  reports.map((r) => {
                    const isOpen = r.status === "open";
                    return (
                      <div 
                        key={r.id} 
                        className={`glass rounded-lg p-4 border border-border/50 flex flex-col md:flex-row justify-between gap-4 ${
                          isOpen ? "border-l-4 border-l-destructive bg-destructive/5" : "border-l-4 border-l-muted opacity-60"
                        }`}
                      >
                        <div className="space-y-2.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={isOpen ? "destructive" : "secondary"} className="text-[9px]">
                              {r.status.toUpperCase()}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              Reported by <strong>{r.reporter_username}</strong> on {new Date(r.created_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="p-3 rounded bg-muted/40 border border-border/50 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">Flagged Message content (Posted by: {r.message_sender_username} {r.message_sender_anonymous && "(Anonymously)"}):</p>
                            <p className="text-xs text-foreground/90 leading-relaxed italic">"{r.message_content}"</p>
                            {r.message_file_name && (
                              <p className="text-[10px] text-primary">Attached File: {r.message_file_name}</p>
                            )}
                          </div>

                          <div className="text-xs">
                            <p className="text-muted-foreground">
                              Reason: <span className="font-semibold text-foreground">{r.reason}</span>
                            </p>
                            {r.details && (
                              <p className="text-muted-foreground mt-0.5">
                                Reporter Notes: <span className="text-foreground italic">"{r.details}"</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {isOpen && (isOwner || hasLocalPermission("resolve_reports")) && (
                          <div className="flex items-center shrink-0">
                            <Button 
                              onClick={() => handleResolveReport(r.id)}
                              className="cursor-pointer text-xs h-8 gap-1 animate-pulse"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" /> Resolve Report
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="glass rounded-lg p-12 text-center border-dashed border border-border/60">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-success" />
                    <p className="text-sm font-semibold text-foreground">Zero Flagged Content</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Excellent! Students haven't submitted any conduct flags.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* 5. REQUESTS TAB */}
          {showRequestsTab && (
            <TabsContent value="requests" className="focus-visible:ring-0 space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                Pending Rename Requests ({stats.pendingRequests} pending)
              </h2>

              <div className="space-y-3">
                {requests.map((r) => {
                  const isPending = r.status === "pending";
                  return (
                    <div 
                      key={r.id} 
                      className={`glass rounded-lg p-4 border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isPending ? "border-t-2 border-t-primary/60" : "opacity-60"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant={isPending ? "primary" : r.status === "approved" ? "success" : "destructive"}>
                            {r.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            Submitted on {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <p className="text-xs text-foreground">
                          Current: <strong className="text-foreground">{r.current_username}</strong> → Requested: <strong className="text-primary">{r.requested_username}</strong>
                        </p>

                        {r.admin_note && (
                          <p className="text-[10px] text-muted-foreground italic">
                            Admin Note: "{r.admin_note}"
                          </p>
                        )}
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0">
                          {(isOwner || hasLocalPermission("approve_username_requests")) && (
                            <Button
                              variant="outline"
                              className="cursor-pointer text-xs h-8 text-success hover:bg-success/10 border-success/30"
                              onClick={() => {
                                setSelectedRequest(r);
                                setRequestApprove(true);
                                setRequestNote("");
                              }}
                            >
                              Approve
                            </Button>
                          )}
                          {(isOwner || hasLocalPermission("reject_username_requests")) && (
                            <Button
                              variant="outline"
                              className="cursor-pointer text-xs h-8 text-destructive hover:bg-destructive/10 border-destructive/30"
                              onClick={() => {
                                setSelectedRequest(r);
                                setRequestApprove(false);
                                setRequestNote("");
                              }}
                            >
                              Reject
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {requests.length === 0 && (
                  <div className="glass rounded-lg p-12 text-center border-dashed border border-border/60">
                    <UserCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                    <p className="text-sm font-semibold text-foreground">No rename requests</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Rename requests submitted by students will appear here.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* 6. SETTINGS TAB */}
          {showSettingsTab && (
            <TabsContent value="settings" className="focus-visible:ring-0">
              <div className="glass rounded-xl border border-border/50 p-5 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-foreground border-b border-border/40 pb-2 flex items-center gap-1.5">
                    <ShieldAlert className="h-4.5 w-4.5 text-primary" /> Classroom Security & Feature Controls
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Toggle features class-wide. Disabling a feature takes effect immediately for all student accounts. Owners and Super Owners bypass these restrictions.
                  </p>
                </div>

                <div className="space-y-5 divide-y divide-border/40 pt-1">
                  
                  {isOwner && (
                    <div className="flex items-start justify-between gap-4 pt-4 first:pt-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-destructive">Emergency Platform Full Lock</p>
                          <Badge variant="destructive" className="animate-pulse font-mono text-[9px] py-0 px-1">SECURITY LOCK</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                          Engages a full classroom-wide lock. All students are immediately put in Read-Only Mode.
                        </p>
                      </div>
                      <Switch
                        checked={getSettingValue("platform_full_lock")}
                        onCheckedChange={() => handleSettingToggle("platform_full_lock", getSettingValue("platform_full_lock"))}
                      />
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4 pt-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-foreground">Classroom Broadcast Feed</p>
                      <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                        Enable or disable the class broadcast stream.
                      </p>
                    </div>
                    <Switch
                      checked={getSettingValue("broadcast_enabled")}
                      onCheckedChange={() => handleSettingToggle("broadcast_enabled", getSettingValue("broadcast_enabled"))}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 pt-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-foreground">Private Peer-to-Peer DMs</p>
                      <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                        Enable or disable private messaging.
                      </p>
                    </div>
                    <Switch
                      checked={getSettingValue("direct_messages_enabled")}
                      onCheckedChange={() => handleSettingToggle("direct_messages_enabled", getSettingValue("direct_messages_enabled"))}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-4 pt-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm text-foreground">File Attachment Uploads</p>
                      <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                        Enable or disable attaching resource files.
                      </p>
                    </div>
                    <Switch
                      checked={getSettingValue("file_uploads_enabled")}
                      onCheckedChange={() => handleSettingToggle("file_uploads_enabled", getSettingValue("file_uploads_enabled"))}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {/* 7. AUDIT LOGS TAB */}
          {showLogsTab && (
            <TabsContent value="logs" className="focus-visible:ring-0 space-y-4">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1 flex items-center gap-1">
                <Activity className="h-4 w-4 text-primary" /> Administrator Activity Audit Trails
              </h2>
              
              <div className="glass rounded-xl border border-border/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/30 text-muted-foreground font-semibold">
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Moderator</th>
                        <th className="p-3">Action Type</th>
                        <th className="p-3">Detailed Log Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/35">
                      {activityLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {log.admin_username}
                          </td>
                          <td className="p-3">
                            <Badge variant={log.action.includes("Suspend") ? "warning" : log.action.includes("Remove") ? "destructive" : "primary"} className="text-[10px] py-0 px-2 font-mono">
                              {log.action}
                            </Badge>
                          </td>
                          <td className="p-3 text-foreground/90 max-w-lg break-words leading-relaxed font-medium">
                            {log.details}
                          </td>
                        </tr>
                      ))}
                      
                      {activityLogs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-muted-foreground">
                            No logs found in the security registry.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* WARNING DIALOG */}
      <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-warning">
              <AlertCircle className="h-5 w-5" /> Send Account Warning
            </DialogTitle>
            <DialogDescription>
              Write a warning message to <strong>{selectedProfile?.username}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-4">
            <textarea
              rows={4}
              value={warningMessage}
              onChange={(e) => setWarningMessage(e.target.value)}
              placeholder="e.g. Please keep discussion respectful."
              required
              className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningOpen(false)} disabled={isSubmittingWarning}>
              Cancel
            </Button>
            <Button variant="accent" onClick={handleSubmitWarning} disabled={isSubmittingWarning || !warningMessage.trim()}>
              {isSubmittingWarning ? "Sending..." : "Issue Warning"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SUSPENSION DIALOG */}
      <Dialog open={suspensionOpen} onOpenChange={setSuspensionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-warning">
              <UserMinus className="h-5 w-5" /> Suspend Student Account
            </DialogTitle>
            <DialogDescription>
              Temporarily place <strong>{selectedProfile?.username}</strong> into Read-Only Mode.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Duration</label>
              <select
                value={suspendDays}
                onChange={(e) => setSuspendDays(e.target.value)}
                className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="1">1 Day</option>
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Reason for Suspension</label>
              <textarea
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Provide a clear reason (this will be displayed to the student)..."
                required
                className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspensionOpen(false)} disabled={isSubmittingSuspension}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSubmitSuspension} disabled={isSubmittingSuspension || !suspendReason.trim()}>
              {isSubmittingSuspension ? "Suspending..." : "Apply Suspension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RENAME DIALOG */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Edit className="h-5 w-5" /> Force Rename Account
            </DialogTitle>
            <DialogDescription>
              Change username for student <strong>{selectedProfile?.username}</strong> immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-4">
            <input
              type="text"
              value={renameUsername}
              onChange={(e) => setRenameUsername(e.target.value)}
              placeholder="Enter new username..."
              required
              className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)} disabled={isSubmittingRename}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRename} disabled={isSubmittingRename || !renameUsername.trim() || renameUsername === selectedProfile?.username}>
              {isSubmittingRename ? "Renaming..." : "Save New Username"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESOLVE REQUEST DIALOG */}
      <Dialog open={selectedRequest !== null} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {requestApprove ? "Approve Rename Request" : "Reject Rename Request"}
            </DialogTitle>
            <DialogDescription>
              {requestApprove 
                ? `This will rename "${selectedRequest?.current_username}" to "${selectedRequest?.requested_username}".` 
                : `This will reject the rename request for "${selectedRequest?.current_username}".`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Admin Note (optional)</label>
            <textarea
              rows={3}
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              placeholder="Add a note explaining your decision..."
              className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRequest(null)} disabled={isSubmittingRequestResolution}>
              Cancel
            </Button>
            <Button 
              variant={requestApprove ? "default" : "destructive"} 
              onClick={handleSubmitRequestResolution} 
              disabled={isSubmittingRequestResolution}
              className="cursor-pointer"
            >
              {isSubmittingRequestResolution ? "Resolving..." : requestApprove ? "Approve & Rename" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT ADMIN PERMISSIONS DIALOG */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Shield className="h-5 w-5 text-primary" /> Manage Custom Permissions
            </DialogTitle>
            <DialogDescription>
              Configure granular system-wide permissions for {targetAdminProfile?.pending_role.replace("_", " ")} <strong>{targetAdminProfile?.username}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            {PERMISSION_GROUPS.map((group) => {
              const fullyChecked = isGroupFullyChecked(group.title);
              
              return (
                <div key={group.title} className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2.5">
                  
                  <button
                    type="button"
                    onClick={() => handleGroupToggle(group.title, fullyChecked)}
                    className="flex items-center gap-2 font-bold text-xs text-primary uppercase tracking-wider cursor-pointer w-full text-left select-none"
                  >
                    {fullyChecked ? (
                      <CheckSquare className="h-4.5 w-4.5 text-primary shrink-0" />
                    ) : (
                      <Square className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                    )}
                    {group.title}
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 pt-1">
                    {group.keys.map((key) => {
                      const isChecked = editedPermissions[key] === true;
                      
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handlePermissionCheckboxToggle(key)}
                          className="flex items-center gap-2 text-xs text-foreground/95 cursor-pointer text-left select-none hover:text-foreground"
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                          )}
                          <span className="capitalize">{key.replace(/_/g, " ")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsOpen(false)} disabled={isSavingPermissions}>
              Cancel
            </Button>
            <Button onClick={handleSavePermissions} disabled={isSavingPermissions}>
              {isSavingPermissions ? "Saving..." : "Save Security Rules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

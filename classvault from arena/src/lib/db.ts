import { 
  usernameToEmail, 
  isValidUsername, 
  isValidPassword 
} from "./auth-helpers";
import { toast } from "sonner";

// Database typescript definitions matching upgraded role hierarchy
export type AppRole = 'super_owner' | 'owner' | 'admin' | 'student';
export type AccountStatus = 'active' | 'suspended' | 'removed';

// Available Admin Permissions
export const ALL_PERMISSION_KEYS = [
  // User Management
  "create_students",
  "edit_students",
  "suspend_students",
  "unsuspend_students",
  "remove_students",
  "send_warnings",
  // Content Moderation
  "view_broadcasts",
  "view_direct_messages",
  "delete_messages",
  "handle_reports",
  "resolve_reports",
  // Username Requests
  "approve_username_requests",
  "reject_username_requests",
  // Privacy Controls
  "view_anonymous_identities",
  // System / Feature Controls
  "manage_feature_toggles",
  // Analytics / Data
  "view_analytics",
  "export_data",
  // Admin Management
  "create_admins",
  // Group Chat Management
  "manage_group_chats"
] as const;

export type PermissionKey = typeof ALL_PERMISSION_KEYS[number];

export interface AdminPermission {
  admin_id: string; // profile_id of the admin
  permission_key: string;
  allowed: boolean;
}

export interface AdminActivityLog {
  id: string;
  admin_id: string;
  admin_username: string;
  action: string;
  details: string;
  created_at: string;
}

export interface GroupChat {
  id: string;
  name: string;
  description: string;
  created_by: string; // profile_id
  created_at: string;
  members: string[]; // array of profile_ids
  avatar_color: string; // Tailwind class, e.g., 'bg-primary/20 text-primary'
}

export interface Profile {
  id: string;
  user_id: string | null;
  username: string;
  status: AccountStatus;
  suspended_until: string | null;
  suspension_reason: string | null;
  anonymous: boolean;
  password_set: boolean;
  pending_role: AppRole;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string | null; // null = broadcast or group
  group_id: string | null; // set if group chat
  parent_id: string | null; // thread reply
  content: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  
  // Joined fields (for client convenience)
  sender_username?: string;
  sender_anonymous?: boolean;
  recipient_username?: string;
  replies?: Message[];
}

export interface Report {
  id: string;
  reporter_id: string;
  message_id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'resolved';
  created_at: string;
  
  // Joined/denormalized fields
  reporter_username?: string;
  message_content?: string;
  message_sender_username?: string;
  message_sender_anonymous?: boolean;
  message_file_name?: string | null;
  message_recipient_id?: string | null;
}

export interface Warning {
  id: string;
  profile_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface UsernameRequest {
  id: string;
  profile_id: string;
  requested_username: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  current_username?: string;
}

export interface AppSetting {
  key: string;
  value: any;
  updated_at: string;
}

interface DatabaseState {
  profiles: Profile[];
  user_roles: UserRole[];
  messages: Message[];
  reports: Report[];
  warnings: Warning[];
  username_requests: UsernameRequest[];
  app_settings: AppSetting[];
  admin_permissions: AdminPermission[];
  admin_activity_logs: AdminActivityLog[];
  group_chats: GroupChat[];
}

// Key for LocalStorage persistence
const DB_STORAGE_KEY = "classvault_db_v2";
const SESSION_STORAGE_KEY = "classvault_session_v2";

// Helper to generate UUIDs
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Initial Seed Data
const getInitialState = (): DatabaseState => {
  // Primary IDs
  const superOwnerId = "p-superowner-id";
  const ownerId = "p-owner-sarah-id";
  const adminId = "p-admin-helen-id";
  const aliceId = "p-alice-id";
  const bobId = "p-bob-id";
  const charlieId = "p-charlie-id";
  const danId = "p-dan-id";

  // Pre-seed profiles
  const profiles: Profile[] = [
    {
      id: superOwnerId,
      user_id: "u-superowner-uuid",
      username: "super_owner",
      status: "active",
      suspended_until: null,
      suspension_reason: null,
      anonymous: false,
      password_set: true,
      pending_role: "super_owner",
      created_at: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: ownerId,
      user_id: "u-owner-sarah-uuid",
      username: "owner_sarah",
      status: "active",
      suspended_until: null,
      suspension_reason: null,
      anonymous: false,
      password_set: true,
      pending_role: "owner",
      created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: adminId,
      user_id: "u-admin-helen-uuid",
      username: "admin_helen",
      status: "active",
      suspended_until: null,
      suspension_reason: null,
      anonymous: false,
      password_set: true,
      pending_role: "admin",
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: aliceId,
      user_id: null, // unclaimed student
      username: "alice",
      status: "active",
      suspended_until: null,
      suspension_reason: null,
      anonymous: false,
      password_set: false,
      pending_role: "student",
      created_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: bobId,
      user_id: "u-bob-uuid", // claimed student
      username: "bob",
      status: "active",
      suspended_until: null,
      suspension_reason: null,
      anonymous: true, // defaults to anonymous
      password_set: true,
      pending_role: "student",
      created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: charlieId,
      user_id: "u-charlie-uuid", // claimed student
      username: "charlie",
      status: "active",
      suspended_until: null,
      suspension_reason: null,
      anonymous: false, // public student
      password_set: true,
      pending_role: "student",
      created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: danId,
      user_id: "u-dan-uuid", // claimed student
      username: "dan",
      status: "active",
      suspended_until: null,
      suspension_reason: null,
      anonymous: true,
      password_set: true,
      pending_role: "student",
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    }
  ];

  // Pre-seed roles
  const user_roles: UserRole[] = [
    { id: generateUUID(), user_id: "u-superowner-uuid", role: "super_owner" },
    { id: generateUUID(), user_id: "u-owner-sarah-uuid", role: "owner" },
    { id: generateUUID(), user_id: "u-admin-helen-uuid", role: "admin" },
    { id: generateUUID(), user_id: "u-bob-uuid", role: "student" },
    { id: generateUUID(), user_id: "u-charlie-uuid", role: "student" },
    { id: generateUUID(), user_id: "u-dan-uuid", role: "student" }
  ];

  // Pre-seed Admin Permissions for Helen (has all user control but NO DM viewing and NO platform toggles)
  const admin_permissions: AdminPermission[] = ALL_PERMISSION_KEYS.map(key => {
    // Helen has restricted rights by default:
    // Allowed: User management, Warnings, Broadcast viewing, Report handling, Username requests, Analytics.
    // Blocked: Viewing DMs, Deleting messages, Privacy overrides (anonymous identities), system feature toggles, admin creation.
    const allowed = [
      "create_students",
      "edit_students",
      "suspend_students",
      "unsuspend_students",
      "send_warnings",
      "view_broadcasts",
      "handle_reports",
      "resolve_reports",
      "approve_username_requests",
      "reject_username_requests",
      "view_analytics"
    ].includes(key);

    return {
      admin_id: adminId,
      permission_key: key,
      allowed
    };
  });

  // Pre-seed messages
  const msg1Id = "m-broadcast-1";
  const msg2Id = "m-broadcast-2";
  const messages: Message[] = [
    {
      id: msg1Id,
      sender_id: charlieId,
      recipient_id: null,
      group_id: null,
      parent_id: null,
      content: "Hey guys! Does anyone have the Physics Chapter 3 notes? I missed Tuesday's class and really need to catch up before the quiz on Friday! Thanks in advance! 🙏",
      file_path: "notes/u-charlie-uuid/1700000000-physics_ch3_syllabus.pdf",
      file_name: "physics_ch3_syllabus.pdf",
      file_size: 1542890,
      created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
    },
    {
      id: generateUUID(),
      sender_id: bobId, // anonymous (bob)
      recipient_id: null,
      group_id: null,
      parent_id: msg1Id,
      content: "I have a detailed summary of the main formulas and the textbook homework solutions. Let me DM them to you!",
      file_path: null,
      file_name: null,
      file_size: null,
      created_at: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString()
    },
    {
      id: generateUUID(),
      sender_id: bobId, // anonymous (bob)
      recipient_id: charlieId,
      group_id: null,
      parent_id: null,
      content: "Hey Charlie, here are the Physics Chapter 3 formula sheets we did on Tuesday. Let me know if you need help with the practice problems!",
      file_path: "notes/u-bob-uuid/1700000001-physics_ch3_formulas.pdf",
      file_name: "physics_ch3_formulas.pdf",
      file_size: 3421900,
      created_at: new Date(Date.now() - 3.4 * 3600 * 1000).toISOString()
    },
    {
      id: generateUUID(),
      sender_id: charlieId,
      recipient_id: bobId,
      group_id: null,
      parent_id: null,
      content: "Wow! Thank you so much, Anonymous classmate! This is extremely helpful and perfectly structured. You literally saved my grade. 😭🙌",
      file_path: null,
      file_name: null,
      file_size: null,
      created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    },
    {
      id: msg2Id,
      sender_id: danId, // anonymous (dan)
      recipient_id: null,
      group_id: null,
      parent_id: null,
      content: "Quick reminder: The Math homework on limits is due tonight by 11:59 PM. Don't forget to upload it to the portal!",
      file_path: null,
      file_name: null,
      file_size: null,
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    }
  ];

  // Pre-seed Group Chats
  const group_chats: GroupChat[] = [
    {
      id: "group-physics-study",
      name: "Physics Study Circle",
      description: "Collaborative group chat for homework help, exam prep, and note sharing.",
      created_by: ownerId,
      created_at: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
      members: [superOwnerId, ownerId, adminId, bobId, charlieId, danId],
      avatar_color: "bg-primary/20 text-primary"
    },
    {
      id: "group-math-olympiad",
      name: "Math Olympiad Prep",
      description: "Advanced calculus, limits, and math competitions brainstorming.",
      created_by: superOwnerId,
      created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      members: [superOwnerId, ownerId, charlieId, danId],
      avatar_color: "bg-accent/20 text-accent"
    }
  ];

  // Seed some group messages
  messages.push(
    {
      id: generateUUID(),
      sender_id: charlieId,
      recipient_id: null,
      group_id: "group-physics-study",
      parent_id: null,
      content: "Welcome to the Physics Study Circle! Feel free to share any useful documents here.",
      file_path: null,
      file_name: null,
      file_size: null,
      created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: generateUUID(),
      sender_id: ownerId, // Sarah
      recipient_id: null,
      group_id: "group-physics-study",
      parent_id: null,
      content: "Glad to see this study group active. Make sure to keep it focused on coursework!",
      file_path: null,
      file_name: null,
      file_size: null,
      created_at: new Date(Date.now() - 4.9 * 24 * 3600 * 1000).toISOString()
    }
  );

  // Pre-seed warnings
  const warnings: Warning[] = [
    {
      id: generateUUID(),
      profile_id: bobId,
      message: "Please ensure file uploads in the broadcast channel are directly related to schoolwork. Your previous upload was flagged but allowed.",
      read: false,
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
    }
  ];

  // Pre-seed reports
  const reports: Report[] = [
    {
      id: generateUUID(),
      reporter_id: charlieId,
      message_id: msg2Id,
      reason: "Spam",
      details: "He posted this three times in different places. (Note: this is a test report)",
      status: "open",
      created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString()
    }
  ];

  // Pre-seed username requests
  const username_requests: UsernameRequest[] = [
    {
      id: generateUUID(),
      profile_id: charlieId,
      requested_username: "charles",
      status: "pending",
      admin_note: null,
      created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      resolved_at: null
    }
  ];

  // Pre-seed app settings
  const app_settings: AppSetting[] = [
    { key: "file_uploads_enabled", value: true, updated_at: new Date().toISOString() },
    { key: "broadcast_enabled", value: true, updated_at: new Date().toISOString() },
    { key: "direct_messages_enabled", value: true, updated_at: new Date().toISOString() },
    { key: "platform_full_lock", value: false, updated_at: new Date().toISOString() } // Emergency full platform lock
  ];

  // Pre-seed activity logs
  const admin_activity_logs: AdminActivityLog[] = [
    {
      id: generateUUID(),
      admin_id: adminId,
      admin_username: "admin_helen",
      action: "Issue Warning",
      details: "Issued warning notice to 'bob' regarding schoolwork-related file uploads.",
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
    }
  ];

  return {
    profiles,
    user_roles,
    messages,
    reports,
    warnings,
    username_requests,
    app_settings,
    admin_permissions,
    admin_activity_logs,
    group_chats
  };
};

// Database state container
class LocalDatabase {
  private state: DatabaseState;

  constructor() {
    this.state = this.load();
  }

  // GETTERS FOR GROUPS
  public getGroupChats() { return this.state.group_chats || []; }
  public setGroupChats(groups: GroupChat[]) {
    this.state.group_chats = groups;
    this.save();
  }

  private load(): DatabaseState {
    try {
      const stored = localStorage.getItem(DB_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to parse stored DB, resetting...", e);
    }
    const initial = getInitialState();
    this.saveState(initial);
    return initial;
  }

  private saveState(state: DatabaseState) {
    this.state = state;
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(state));
  }

  public save() {
    this.saveState(this.state);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("classvault-db-update"));
    }
  }

  // GETTERS
  public getProfiles() { return this.state.profiles; }
  public getUserRoles() { return this.state.user_roles; }
  public getMessages() { return this.state.messages; }
  public getReports() { return this.state.reports; }
  public getWarnings() { return this.state.warnings; }
  public getUsernameRequests() { return this.state.username_requests; }
  public getAppSettings() { return this.state.app_settings; }
  public getAdminPermissions() { return this.state.admin_permissions || []; }
  public getAdminActivityLogs() { return this.state.admin_activity_logs || []; }

  // SETTERS (mutations)
  public setProfiles(profiles: Profile[]) {
    this.state.profiles = profiles;
    this.save();
  }

  public setUserRoles(roles: UserRole[]) {
    this.state.user_roles = roles;
    this.save();
  }

  public setMessages(messages: Message[]) {
    this.state.messages = messages;
    this.save();
  }

  public setReports(reports: Report[]) {
    this.state.reports = reports;
    this.save();
  }

  public setWarnings(warnings: Warning[]) {
    this.state.warnings = warnings;
    this.save();
  }

  public setUsernameRequests(requests: UsernameRequest[]) {
    this.state.username_requests = requests;
    this.save();
  }

  public setAppSettings(settings: AppSetting[]) {
    this.state.app_settings = settings;
    this.save();
  }

  public setAdminPermissions(permissions: AdminPermission[]) {
    this.state.admin_permissions = permissions;
    this.save();
  }

  public setAdminActivityLogs(logs: AdminActivityLog[]) {
    this.state.admin_activity_logs = logs;
    this.save();
  }

  // RESET
  public reset() {
    const initial = getInitialState();
    this.saveState(initial);
    return initial;
  }
}

// Instantiate the Local Database
export const localDB = new LocalDatabase();

// --- Auth Session Management ---
export interface AuthSession {
  user: {
    id: string;
    email: string;
    username: string;
  };
  profile: Profile;
  isAdmin: boolean;
  isOwner: boolean;
  isSuperOwner: boolean;
  // Impersonation states
  impersonatingFrom?: Profile; // Original owner profile
}

let activeSession: AuthSession | null = null;
const authListeners: ((session: AuthSession | null) => void)[] = [];

// Seed default passwords into localStorage for seamless mock sign-in (for testing)
const seedDefaultPasswords = () => {
  const passwords = JSON.parse(localStorage.getItem("classvault_passwords") || "{}");
  const defaults: Record<string, string> = {
    [usernameToEmail("super_owner")]: "super123",
    [usernameToEmail("owner_sarah")]: "owner123",
    [usernameToEmail("admin_helen")]: "admin123",
    [usernameToEmail("bob")]: "student123",
    [usernameToEmail("charlie")]: "student123",
    [usernameToEmail("dan")]: "student123",
  };

  let updated = false;
  for (const [email, pwd] of Object.entries(defaults)) {
    if (!passwords[email]) {
      passwords[email] = pwd;
      updated = true;
    }
  }
  if (updated) {
    localStorage.setItem("classvault_passwords", JSON.stringify(passwords));
  }
};
seedDefaultPasswords();

// Hydrate session on load
try {
  const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
  if (storedSession) {
    activeSession = JSON.parse(storedSession);
  }
} catch (e) {
  console.error("Failed to parse auth session on load", e);
}

const triggerAuthChange = () => {
  authListeners.forEach(listener => listener(activeSession));
};

// --- API Implementation ---
export const dbAPI = {
  // Auth Listeners
  onAuthStateChange(callback: (session: AuthSession | null) => void) {
    authListeners.push(callback);
    callback(activeSession);
    return {
      unsubscribe() {
        const index = authListeners.indexOf(callback);
        if (index !== -1) {
          authListeners.splice(index, 1);
        }
      }
    };
  },

  getSession(): AuthSession | null {
    if (activeSession) {
      const profiles = localDB.getProfiles();
      
      // If we are currently impersonating, we check the active target profile
      const targetProfileId = activeSession.profile.id;
      const freshProfile = profiles.find(p => p.id === targetProfileId);
      
      if (freshProfile) {
        activeSession.profile = freshProfile;
        
        // If we have an impersonator, we keep roles as the target profile's roles
        const roles = localDB.getUserRoles();
        const freshRole = roles.find(r => r.user_id === freshProfile.user_id);
        const activeRole = freshRole?.role || freshProfile.pending_role;
        
        activeSession.isAdmin = ['admin', 'owner', 'super_owner'].includes(activeRole);
        activeSession.isOwner = ['owner', 'super_owner'].includes(activeRole);
        activeSession.isSuperOwner = activeRole === 'super_owner';
        
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(activeSession));
      } else {
        // Target profile deleted? End impersonation or clear session
        if (activeSession.impersonatingFrom) {
          this.exitImpersonation();
        } else {
          activeSession = null;
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    }
    return activeSession;
  },

  refreshProfile(): AuthSession | null {
    return this.getSession();
  },

  // Log Admin Action helper
  async logAdminAction(adminId: string, action: string, details: string) {
    const profiles = localDB.getProfiles();
    const admin = profiles.find(p => p.id === adminId);
    if (!admin) return;

    const newLog: AdminActivityLog = {
      id: generateUUID(),
      admin_id: adminId,
      admin_username: admin.username,
      action,
      details,
      created_at: new Date().toISOString()
    };
    
    const logs = localDB.getAdminActivityLogs();
    localDB.setAdminActivityLogs([newLog, ...logs]);
  },

  // Helper to check if an admin has a specific permission
  async hasPermission(adminId: string, key: PermissionKey): Promise<boolean> {
    const profiles = localDB.getProfiles();
    const admin = profiles.find(p => p.id === adminId);
    if (!admin) return false;

    // Super Owners automatically bypass all permission restrictions
    if (admin.pending_role === 'super_owner') {
      return true;
    }

    // Students do not have admin permissions
    if (admin.pending_role === 'student') {
      return false;
    }

    // Admins and Owners check the permission database.
    // Super Owner (or other Owners) can explicitly toggle permissions ON/OFF for Owners.
    // If no record exists: Owners default to TRUE, standard Admins default to FALSE.
    const permissions = localDB.getAdminPermissions();
    const rule = permissions.find(p => p.admin_id === adminId && p.permission_key === key);
    if (rule) {
      return rule.allowed === true;
    }
    
    return admin.pending_role === 'owner';
  },

  // --- Group Chat APIs ---

  // Get all group chats the user is a member of (or all if Owner/Super Owner bypass)
  async getGroupChats(): Promise<GroupChat[]> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");

    const groups = localDB.getGroupChats();
    
    // Owners/Super Owners can see all group chats.
    // Standard students and admins see only groups they are members of.
    if (session.isOwner) {
      return groups;
    }

    return groups.filter(g => g.members.includes(session.profile.id));
  },

  // Create a new group chat (Allowed if has 'manage_group_chats' permission or Owner)
  async createGroupChat({ name, description, members }: { name: string; description: string; members: string[] }): Promise<GroupChat> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");

    // Check permission
    await this.assertPermission(session.profile.id, "manage_group_chats", "create group chats");

    if (!name.trim()) throw new Error("Group name is required.");

    const groupId = "group-" + generateUUID();
    
    // Ensure the creator and Super Owner/Owners are auto-added to the group for visibility if needed,
    // or at least ensure the creator is a member.
    const uniqueMembers = Array.from(new Set([session.profile.id, ...members]));

    const newGroup: GroupChat = {
      id: groupId,
      name: name.trim(),
      description: description.trim(),
      created_by: session.profile.id,
      created_at: new Date().toISOString(),
      members: uniqueMembers,
      avatar_color: [
        "bg-primary/20 text-primary border border-primary/30",
        "bg-accent/20 text-accent border border-accent/30",
        "bg-success/20 text-success border border-success/30",
        "bg-warning/20 text-warning border border-warning/30",
        "bg-destructive/20 text-destructive border border-destructive/30",
      ][Math.floor(Math.random() * 5)]
    };

    const groups = localDB.getGroupChats();
    localDB.setGroupChats([...groups, newGroup]);

    // Log administrative action
    await this.logAdminAction(
      session.profile.id,
      "Create Group Chat",
      `Created group chat "${name.trim()}" with ${uniqueMembers.length} members.`
    );

    return newGroup;
  },

  // Update/Edit group chat details and members (Allowed if has 'manage_group_chats' or Owner)
  async updateGroupChat({ groupId, name, description, members }: { groupId: string; name: string; description: string; members: string[] }): Promise<GroupChat> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");

    // Check permission
    await this.assertPermission(session.profile.id, "manage_group_chats", "edit group chats");

    if (!name.trim()) throw new Error("Group name is required.");

    const groups = localDB.getGroupChats();
    const group = groups.find(g => g.id === groupId);
    if (!group) throw new Error("Group chat not found.");

    const oldName = group.name;
    group.name = name.trim();
    group.description = description.trim();
    
    // Ensure the creator/editor remains in the members list
    const uniqueMembers = Array.from(new Set([group.created_by, session.profile.id, ...members]));
    group.members = uniqueMembers;

    localDB.save();

    // Log administrative action
    await this.logAdminAction(
      session.profile.id,
      "Update Group Chat",
      `Updated group chat "${oldName}" details/members (New name: "${name.trim()}", ${uniqueMembers.length} members).`
    );

    return group;
  },

  // Helper to assert a permission (throws error if unauthorized)
  async assertPermission(adminId: string, key: PermissionKey, actionName?: string) {
    const allowed = await this.hasPermission(adminId, key);
    if (!allowed) {
      throw new Error(`Access denied. You do not have permission to ${actionName || key.replace(/_/g, " ")}.`);
    }
  },

  // --- Auth Server Functions & Actions ---
  
  // 1. Get Bootstrap Status: returns whether any super_owner or owner exists
  async getBootstrapStatus(): Promise<{ needsBootstrap: boolean }> {
    const roles = localDB.getUserRoles();
    const profiles = localDB.getProfiles();
    
    const hasOwnerRole = roles.some(r => ['owner', 'super_owner'].includes(r.role));
    const hasPendingOwner = profiles.some(p => ['owner', 'super_owner'].includes(p.pending_role));
    
    return { needsBootstrap: !hasOwnerRole && !hasPendingOwner };
  },

  // 2. Bootstrap First Super Owner (upgraded from admin)
  async bootstrapFirstAdmin({ username, password }: any): Promise<{ success: boolean; message: string }> {
    const { needsBootstrap } = await this.getBootstrapStatus();
    if (!needsBootstrap) {
      throw new Error("Bootstrap already completed. Owner accounts exist.");
    }

    if (!isValidUsername(username)) {
      throw new Error("Invalid username. Must be 2-32 characters (letters, numbers, _ or -).");
    }
    if (!isValidPassword(password)) {
      throw new Error("Password must be between 6 and 128 characters.");
    }

    const profiles = localDB.getProfiles();
    const existing = profiles.find(p => p.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      throw new Error("Username already taken.");
    }

    const userId = "u-superowner-" + generateUUID();
    const profileId = "p-superowner-" + generateUUID();

    const newProfile: Profile = {
      id: profileId,
      user_id: userId,
      username: username.trim(),
      status: "active",
      suspended_until: null,
      suspension_reason: null,
      anonymous: false,
      password_set: true,
      pending_role: "super_owner",
      created_at: new Date().toISOString()
    };

    const newRole: UserRole = {
      id: generateUUID(),
      user_id: userId,
      role: "super_owner"
    };

    // Save
    localDB.setProfiles([...profiles, newProfile]);
    localDB.setUserRoles([...localDB.getUserRoles(), newRole]);

    // Save passwords locally
    const passwords = JSON.parse(localStorage.getItem("classvault_passwords") || "{}");
    passwords[usernameToEmail(username)] = password;
    localStorage.setItem("classvault_passwords", JSON.stringify(passwords));

    return { success: true, message: "System bootstrap completed! Super Owner account created." };
  },

  // 3. Login
  async signInWithPassword({ username, password }: any): Promise<AuthSession> {
    const email = usernameToEmail(username);
    
    const normalizedInput = username.trim().toLowerCase().normalize("NFC");
    const profiles = localDB.getProfiles();
    const profile = profiles.find(p => p.username.trim().toLowerCase().normalize("NFC") === normalizedInput);

    if (!profile) {
      console.warn("Sign-in failed. Input username:", username, "Normalized:", normalizedInput, "Available profiles in DB:", profiles.map(p => p.username));
      throw new Error("Account not found. Please verify the username or contact your classroom admin.");
    }

    // 2. Check if the account has not been claimed yet
    const isDefaultStudent = ["bob", "charlie", "dan"].includes(username.toLowerCase());
    const isMockAuth = isDefaultStudent && password === "student123";
    
    if (!profile.password_set && !isMockAuth) {
      throw new Error("This account has not been claimed yet. Please go to the 'Claim Account' tab to set your password first.");
    }

    // 3. Check if account is soft-removed
    if (profile.status === 'removed') {
      throw new Error("This account has been removed by the administrator.");
    }

    // 4. Verify password
    const passwords = JSON.parse(localStorage.getItem("classvault_passwords") || "{}");
    const correctPassword = passwords[email];

    if (correctPassword !== password && !isMockAuth) {
      throw new Error("Invalid username or password.");
    }

    if (isMockAuth && !profile.user_id) {
      profile.user_id = `u-${profile.username}-uuid`;
      profile.password_set = true;
      localDB.save();
    }

    const userId = profile.user_id || "u-" + profile.username + "-uuid";

    // Ensure role row exists in user_roles
    const roles = localDB.getUserRoles();
    let userRole = roles.find(r => r.user_id === userId);
    if (!userRole) {
      userRole = {
        id: generateUUID(),
        user_id: userId,
        role: profile.pending_role
      };
      localDB.setUserRoles([...roles, userRole]);
    }

    const activeRole = userRole.role || profile.pending_role;

    // Set session
    const session: AuthSession = {
      user: {
        id: userId,
        email: email,
        username: profile.username
      },
      profile: profile,
      isAdmin: ['admin', 'owner', 'super_owner'].includes(activeRole),
      isOwner: ['owner', 'super_owner'].includes(activeRole),
      isSuperOwner: activeRole === 'super_owner'
    };

    activeSession = session;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    triggerAuthChange();

    return session;
  },

  // 4. Claim Account (Student/Admin claims their username)
  async claimAccount({ username, password }: any): Promise<{ success: boolean; message: string }> {
    if (!isValidUsername(username)) {
      throw new Error("Invalid username.");
    }
    if (!isValidPassword(password)) {
      throw new Error("Password must be between 6 and 128 characters.");
    }

    const normalizedInput = username.trim().toLowerCase().normalize("NFC");
    const profiles = localDB.getProfiles();
    const profile = profiles.find(p => p.username.trim().toLowerCase().normalize("NFC") === normalizedInput);

    if (!profile) {
      console.warn("Claim failed. Input username:", username, "Normalized:", normalizedInput, "Available profiles in DB:", profiles.map(p => p.username));
      throw new Error("This username was not pre-created by the admin. Please contact your classroom admin.");
    }

    if (profile.password_set) {
      throw new Error("This account has already been claimed. Please sign in.");
    }

    if (profile.status === 'removed') {
      throw new Error("This account has been removed by the administrator.");
    }

    const userId = "u-" + profile.username + "-" + generateUUID();
    
    // Update profile
    profile.user_id = userId;
    profile.password_set = true;
    localDB.save();

    // Create user role
    const roles = localDB.getUserRoles();
    const newRole: UserRole = {
      id: generateUUID(),
      user_id: userId,
      role: profile.pending_role
    };
    localDB.setUserRoles([...roles, newRole]);

    // Save password
    const passwords = JSON.parse(localStorage.getItem("classvault_passwords") || "{}");
    passwords[usernameToEmail(username)] = password;
    localStorage.setItem("classvault_passwords", JSON.stringify(passwords));

    return { success: true, message: "Account claimed successfully! You can now log in." };
  },

  // 5. Sign Out
  async signOut(): Promise<void> {
    activeSession = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
    triggerAuthChange();
  },

  // 6. Set Anonymous (Student toggles anonymous mode)
  async setAnonymous({ anonymous }: { anonymous: boolean }): Promise<Profile> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");

    const profiles = localDB.getProfiles();
    const profile = profiles.find(p => p.id === session.profile.id);
    if (!profile) throw new Error("Profile not found.");

    profile.anonymous = anonymous;
    localDB.save();

    session.profile = profile;
    activeSession = session;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    triggerAuthChange();

    return profile;
  },

  // 7. Change Password
  async changePassword({ newPassword }: any): Promise<{ success: boolean }> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");

    if (!isValidPassword(newPassword)) {
      throw new Error("Password must be between 6 and 128 characters.");
    }

    const passwords = JSON.parse(localStorage.getItem("classvault_passwords") || "{}");
    passwords[session.user.email] = newPassword;
    localStorage.setItem("classvault_passwords", JSON.stringify(passwords));

    return { success: true };
  },

  // 8. Request Username Change
  async requestUsernameChange({ requested }: { requested: string }): Promise<UsernameRequest> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");
    
    // Check suspension/read-only restriction
    if (session.profile.status === 'suspended') {
      throw new Error("Your account is currently suspended (Read-Only Mode). You cannot submit username requests.");
    }
    if (session.profile.status !== 'active') {
      throw new Error("Account is inactive.");
    }

    if (!isValidUsername(requested)) {
      throw new Error("Invalid requested username.");
    }

    const profiles = localDB.getProfiles();
    const existing = profiles.find(p => p.username.toLowerCase() === requested.toLowerCase());
    if (existing) {
      throw new Error("This username is already taken.");
    }

    const newRequest: UsernameRequest = {
      id: generateUUID(),
      profile_id: session.profile.id,
      requested_username: requested.trim(),
      status: 'pending',
      admin_note: null,
      created_at: new Date().toISOString(),
      resolved_at: null
    };

    localDB.setUsernameRequests([...localDB.getUsernameRequests(), newRequest]);
    return newRequest;
  },

  // 9. Mark Warning Read
  async markWarningRead({ warningId }: { warningId: string }): Promise<Warning> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");

    const warnings = localDB.getWarnings();
    const warning = warnings.find(w => w.id === warningId && w.profile_id === session.profile.id);
    if (!warning) throw new Error("Warning not found.");

    warning.read = true;
    localDB.save();

    return warning;
  },

  // --- Student-facing queries ---
  
  // Get settings
  async getSettings(): Promise<AppSetting[]> {
    return localDB.getAppSettings();
  },

  // Get active setting value by key
  async getSettingValue(key: string): Promise<boolean> {
    const settings = localDB.getAppSettings();
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value === true : true;
  },

  // Get student's warnings
  async getWarnings(): Promise<Warning[]> {
    const session = this.getSession();
    if (!session) return [];
    
    return localDB.getWarnings()
      .filter(w => w.profile_id === session.profile.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // Get student's username requests
  async getMyUsernameRequests(): Promise<UsernameRequest[]> {
    const session = this.getSession();
    if (!session) return [];

    return localDB.getUsernameRequests()
      .filter(r => r.profile_id === session.profile.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // Get classmate list for DMs (public profiles) - SILENT GOVERNANCE: Filters out owners/super owners completely
  async getPublicProfiles(): Promise<any[]> {
    const session = this.getSession();
    if (!session) return [];

    const profiles = localDB.getProfiles();
    
    return profiles
      .filter(p => {
        // Filter out removed profiles and self
        if (p.status === 'removed' || p.id === session.profile.id) return false;
        // Silent Governance: Hide Owner and Super Owner accounts from students/admins
        if (['owner', 'super_owner'].includes(p.pending_role)) return false;
        return true;
      })
      .map(p => ({
        id: p.id,
        username: p.username,
        status: p.status,
        anonymous: p.anonymous
      }));
  },

  // Get Broadcast, DM, or Group Messages
  async getMessages({ recipientId = null, groupId = null, limit = 100 }: { recipientId?: string | null, groupId?: string | null, limit?: number } = {}): Promise<Message[]> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");

    const isBroadcastEnabled = await this.getSettingValue("broadcast_enabled");
    const isDirectEnabled = await this.getSettingValue("direct_messages_enabled");

    // Owners can always view everything, bypassing features/locks
    const isOwnerBypass = session.isOwner;

    // Check permissions if the user is a standard admin
    const canViewBroadcasts = session.isAdmin ? (await this.hasPermission(session.profile.id, "view_broadcasts")) : true;
    const canViewDMs = session.isAdmin ? (await this.hasPermission(session.profile.id, "view_direct_messages")) : true;
    const canViewAnon = session.isAdmin ? (await this.hasPermission(session.profile.id, "view_anonymous_identities")) : false;

    // Safety audit logging for view_anonymous_identities by admins
    const shouldLogAnonAudit = session.isAdmin && !session.isOwner && canViewAnon;

    const messages = localDB.getMessages();
    const profiles = localDB.getProfiles();

    // Filter messages
    let filtered = messages.filter(m => {
      // If groupId is specified, filter for group messages
      if (groupId !== null) {
        // Group messages (Verify membership or owner bypass)
        const groups = localDB.getGroupChats();
        const group = groups.find(g => g.id === groupId);
        if (!group) return false;
        if (!isOwnerBypass && !group.members.includes(session.profile.id)) return false;
        return m.group_id === groupId;
      }

      if (recipientId === null) {
        // Broadcasts (Verify group_id is null to separate broadcasts from groups)
        if (m.group_id !== null) return false;
        if (!isOwnerBypass && !canViewBroadcasts) return false;
        if (!isOwnerBypass && !isBroadcastEnabled && !session.isAdmin) return false;
        return m.recipient_id === null;
      } else {
        // DMs between current user and recipientId
        if (!isOwnerBypass && !canViewDMs) return false;
        if (!isOwnerBypass && !isDirectEnabled && !session.isAdmin) return false;
        
        // Admins/Owners bypass the ownership check if they are viewing a direct message list (managed via specific panels)
        if (session.isAdmin) {
          // If we are in direct pane, render between user and selected partner
          const myProfileId = session.profile.id;
          return (m.sender_id === myProfileId && m.recipient_id === recipientId) || 
                 (m.sender_id === recipientId && m.recipient_id === myProfileId);
        }
        
        const myProfileId = session.profile.id;
        return (m.sender_id === myProfileId && m.recipient_id === recipientId) || 
               (m.sender_id === recipientId && m.recipient_id === myProfileId);
      }
    });

    let didLogAudit = false;

    // Populate sender/recipient details
    const result: Message[] = filtered.map(m => {
      const sender = profiles.find(p => p.id === m.sender_id);
      const recipient = m.recipient_id ? profiles.find(p => p.id === m.recipient_id) : null;
      
      let senderUsername = "Anonymous";
      let senderAnonymous = sender?.anonymous ?? false;

      // Real username is shown if:
      // 1. Caller is Owner/Super Owner (Always bypass)
      // 2. Caller is Admin and has 'view_anonymous_identities' permission
      // 3. Message was sent by caller themselves
      // 4. Sender is not in anonymous mode
      const revealIdentity = session.isOwner || 
                              (session.isAdmin && canViewAnon) || 
                              m.sender_id === session.profile.id || 
                              !senderAnonymous;

      if (revealIdentity) {
        senderUsername = sender?.username ?? "Unknown Student";
        // Audit log once per fetch if an admin reads an anonymous identity
        if (shouldLogAnonAudit && senderAnonymous && !didLogAudit) {
          didLogAudit = true;
          this.logAdminAction(
            session.profile.id,
            "View Anonymous Identities",
            `Admin viewed anonymous identities in broadcast/DM feed.`
          );
        }
      }

      let recipientUsername = undefined;
      if (recipient) {
        const revealRecipient = session.isOwner || 
                                 (session.isAdmin && canViewAnon) || 
                                 recipient.id === session.profile.id || 
                                 !recipient.anonymous;

        recipientUsername = revealRecipient ? recipient.username : "Anonymous";
      }

      return {
        ...m,
        sender_username: senderUsername,
        sender_anonymous: senderAnonymous,
        recipient_username: recipientUsername,
      };
    });

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Group replies
    const parents = result.filter(m => !m.parent_id);
    const replies = result.filter(m => m.parent_id);

    parents.forEach(parent => {
      parent.replies = replies
        .filter(r => r.parent_id === parent.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    return parents.slice(0, limit);
  },

  // Send Message (Broadcast, DM, or Group)
  async sendMessage({ content, recipientId = null, groupId = null, parentId = null, file }: { content: string; recipientId?: string | null; groupId?: string | null; parentId?: string | null; file?: { name: string; size: number; dataUrl: string } | null }): Promise<Message> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");

    // 1. Suspension puts them in Read-Only Mode (Check suspensions)
    if (session.profile.status === 'suspended' && !session.isOwner) {
      const until = session.profile.suspended_until ? new Date(session.profile.suspended_until) : null;
      if (until && until > new Date()) {
        throw new Error(`Suspension Active (Read-Only Mode): You cannot send messages until ${until.toLocaleString()}.`);
      }
    }

    // 2. Emergency locks checking (Platform lock blocks students completely from editing/creating)
    const isPlatformLocked = await this.getSettingValue("platform_full_lock");
    if (isPlatformLocked && !session.isOwner && !session.isAdmin) {
      throw new Error("Emergency Lock Active: The platform is temporarily locked in Read-Only Mode.");
    }

    // 3. Specific feature flags checking
    if (groupId === null) {
      if (recipientId === null) {
        const isBroadcastEnabled = await this.getSettingValue("broadcast_enabled");
        if (!isBroadcastEnabled && !session.isOwner && !session.isAdmin) {
          throw new Error("Class broadcast messages are currently disabled by the administrator.");
        }
      } else {
        const isDirectEnabled = await this.getSettingValue("direct_messages_enabled");
        if (!isDirectEnabled && !session.isOwner && !session.isAdmin) {
          throw new Error("Direct messaging is currently disabled by the administrator.");
        }
      }
    }

    // 4. File uploads checking
    if (file) {
      const isUploadEnabled = await this.getSettingValue("file_uploads_enabled");
      if (!isUploadEnabled && !session.isOwner && !session.isAdmin) {
        throw new Error("File uploads are currently disabled by the administrator.");
      }
      if (file.size > 400 * 1024 * 1024) {
        throw new Error("File size exceeds the 400 MB limit.");
      }
    }

    const messageId = generateUUID();
    const newMsg: Message = {
      id: messageId,
      sender_id: session.profile.id,
      recipient_id: recipientId,
      group_id: groupId,
      parent_id: parentId,
      content: content.trim(),
      file_path: file ? `notes/${session.user.id}/${Date.now()}-${file.name}` : null,
      file_name: file ? file.name : null,
      file_size: file ? file.size : null,
      created_at: new Date().toISOString()
    };

    if (file && file.dataUrl) {
      const fileStore = JSON.parse(localStorage.getItem("classvault_files") || "{}");
      fileStore[newMsg.file_path!] = file.dataUrl;
      localStorage.setItem("classvault_files", JSON.stringify(fileStore));
    }

    localDB.setMessages([...localDB.getMessages(), newMsg]);

    return {
      ...newMsg,
      sender_username: session.profile.anonymous ? "Anonymous" : session.profile.username,
      sender_anonymous: session.profile.anonymous,
      replies: []
    };
  },

  // Create Report
  async createReport({ messageId, reason, details }: { messageId: string; reason: string; details: string | null }): Promise<Report> {
    const session = this.getSession();
    if (!session) throw new Error("Unauthorized.");

    // Block if suspended
    if (session.profile.status === 'suspended' && !session.isOwner) {
      throw new Error("Suspension Active (Read-Only Mode): You cannot report messages.");
    }

    const newReport: Report = {
      id: generateUUID(),
      reporter_id: session.profile.id,
      message_id: messageId,
      reason,
      details,
      status: 'open',
      created_at: new Date().toISOString()
    };

    localDB.setReports([...localDB.getReports(), newReport]);
    return newReport;
  },

  // --- Impersonation / Act As User Mode (Owner Only) ---
  async impersonateUser(targetProfileId: string): Promise<AuthSession> {
    const session = this.getSession();
    if (!session || !session.isOwner) {
      throw new Error("Access denied. Owner-only impersonation feature.");
    }

    const profiles = localDB.getProfiles();
    const targetProfile = profiles.find(p => p.id === targetProfileId);
    if (!targetProfile) throw new Error("Target student or admin profile not found.");

    // Prevent impersonating another super owner or owner
    if (targetProfile.pending_role === 'super_owner' || targetProfile.pending_role === 'owner') {
      throw new Error("Security Lock: You cannot impersonate another Owner or Super Owner.");
    }

    const originalOwnerProfile = session.impersonatingFrom || session.profile;

    // Setup active session impersonation
    const impersonatedSession: AuthSession = {
      user: {
        id: targetProfile.user_id || "u-" + targetProfile.username + "-uuid",
        email: usernameToEmail(targetProfile.username),
        username: targetProfile.username
      },
      profile: targetProfile,
      isAdmin: ['admin', 'owner', 'super_owner'].includes(targetProfile.pending_role),
      isOwner: false,
      isSuperOwner: false,
      impersonatingFrom: originalOwnerProfile
    };

    activeSession = impersonatedSession;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(impersonatedSession));
    triggerAuthChange();

    toast.success(`Impersonation active: Viewing as "${targetProfile.username}"`);
    return impersonatedSession;
  },

  // Exit Impersonation Mode
  async exitImpersonation(): Promise<AuthSession> {
    if (!activeSession || !activeSession.impersonatingFrom) {
      throw new Error("No active impersonation session.");
    }

    const originalOwner = activeSession.impersonatingFrom;
    
    // Rebuild original owner session
    const restoredSession: AuthSession = {
      user: {
        id: originalOwner.user_id!,
        email: usernameToEmail(originalOwner.username),
        username: originalOwner.username
      },
      profile: originalOwner,
      isAdmin: true,
      isOwner: true,
      isSuperOwner: originalOwner.pending_role === 'super_owner'
    };

    activeSession = restoredSession;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(restoredSession));
    triggerAuthChange();

    toast.success(`Exited impersonation. Returned to Owner view.`);
    return restoredSession;
  },

  // --- Admin/Owner Server Functions (Admin roles only) ---
  
  // Create Account (Pre-creates student/admin/owner account, with optional custom permissions)
  async createAccount({ username, role, permissions }: { username: string; role: AppRole; permissions?: Record<string, boolean> }): Promise<Profile> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Owner Override & Permission Assertions
    if (!session.isOwner) {
      if (role === 'admin') {
        await this.assertPermission(session.profile.id, "create_admins", "create other administrators");
      } else {
        await this.assertPermission(session.profile.id, "create_students", "pre-create student accounts");
      }
    }

    // Role protection
    if (role === 'super_owner') {
      throw new Error("Access denied. Super Owners can only be created by other Super Owners.");
    }
    if (role === 'owner' && !session.isSuperOwner) {
      throw new Error("Access denied. Only the Super Owner can create other Owner accounts.");
    }

    if (!isValidUsername(username)) {
      throw new Error("Invalid username format. Use 2-32 alphanumeric characters, - or _.");
    }

    const profiles = localDB.getProfiles();
    const existing = profiles.find(p => p.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      if (existing.status === 'removed') {
        // Resurrect account (Soft delete undo)
        existing.status = 'active';
        existing.password_set = false;
        existing.user_id = null;
        existing.pending_role = role;
        localDB.save();
        
        // Log action
        await this.logAdminAction(
          session.profile.id,
          "Restore Account",
          `Resurrected/restored removed account "${username}" as role "${role}".`
        );
        return existing;
      }
      throw new Error("Username already exists.");
    }

    const newProfileId = "p-" + username + "-" + generateUUID();
    const newProfile: Profile = {
      id: newProfileId,
      user_id: null,
      username: username.trim(),
      status: "active",
      suspended_until: null,
      suspension_reason: null,
      anonymous: true,
      password_set: false,
      pending_role: role,
      created_at: new Date().toISOString()
    };

    localDB.setProfiles([...profiles, newProfile]);

    // If an Admin creates another Admin, Admin B automatically inherits the exact same permissions.
    // If Owner creates Admin with custom checkbox permissions, save those!
    if (role === 'admin') {
      const defaultPermissions: AdminPermission[] = [];
      
      if (permissions) {
        // Use custom checkboxes selected during creation
        ALL_PERMISSION_KEYS.forEach(key => {
          defaultPermissions.push({
            admin_id: newProfileId,
            permission_key: key,
            allowed: permissions[key] === true
          });
        });
      } else if (session.isOwner) {
        // Owner-created admins receive all permissions by default if not specified
        ALL_PERMISSION_KEYS.forEach(key => {
          defaultPermissions.push({
            admin_id: newProfileId,
            permission_key: key,
            allowed: true
          });
        });
      } else {
        // Admin-created admins inherit exact permissions from creating admin
        const myPermissions = localDB.getAdminPermissions().filter(p => p.admin_id === session.profile.id);
        ALL_PERMISSION_KEYS.forEach(key => {
          const inheritedAllowed = myPermissions.find(p => p.permission_key === key)?.allowed === true;
          defaultPermissions.push({
            admin_id: newProfileId,
            permission_key: key,
            allowed: inheritedAllowed
          });
        });
      }
      localDB.setAdminPermissions([...localDB.getAdminPermissions(), ...defaultPermissions]);
    }

    // Similarly, if Owner creates another Owner, we can initialize their permissions
    if (role === 'owner') {
      const defaultPermissions: AdminPermission[] = [];
      if (permissions) {
        ALL_PERMISSION_KEYS.forEach(key => {
          defaultPermissions.push({
            admin_id: newProfileId,
            permission_key: key,
            allowed: permissions[key] === true
          });
        });
      } else {
        ALL_PERMISSION_KEYS.forEach(key => {
          defaultPermissions.push({
            admin_id: newProfileId,
            permission_key: key,
            allowed: true // Owner defaults to true
          });
        });
      }
      localDB.setAdminPermissions([...localDB.getAdminPermissions(), ...defaultPermissions]);
    }

    // Log Action
    await this.logAdminAction(
      session.profile.id,
      "Create Account",
      `Pre-created account for "${username}" with role "${role}".`
    );

    return newProfile;
  },

  // Edit Admin Permissions (Owner / Super Owner Only)
  async updateAdminPermissions({ adminId, permissions }: { adminId: string; permissions: Record<string, boolean> }): Promise<void> {
    const session = this.getSession();
    if (!session || !session.isOwner) {
      throw new Error("Access denied. Only Owners and Super Owners can edit admin permissions.");
    }

    const profiles = localDB.getProfiles();
    const targetAdmin = profiles.find(p => p.id === adminId);
    if (!targetAdmin) {
      throw new Error("Target account not found.");
    }
    
    // Super Owner can edit Owners and Admins. Owners can edit Admins.
    const isTargetAdminOrOwner = ['admin', 'owner'].includes(targetAdmin.pending_role);
    if (!isTargetAdminOrOwner) {
      throw new Error("Target account is not an administrator or owner.");
    }
    
    if (targetAdmin.pending_role === 'owner' && !session.isSuperOwner) {
      throw new Error("Security Lock: Only the Super Owner can edit another Owner's permissions.");
    }

    const currentPermissions = localDB.getAdminPermissions().filter(p => p.admin_id !== adminId);
    const newRules: AdminPermission[] = Object.entries(permissions).map(([key, allowed]) => ({
      admin_id: adminId,
      permission_key: key,
      allowed: allowed === true
    }));

    localDB.setAdminPermissions([...currentPermissions, ...newRules]);
    
    // Log action
    await this.logAdminAction(
      session.profile.id,
      "Edit Permissions",
      `Updated custom security permissions for administrator "${targetAdmin.username}".`
    );
  },

  // Soft Remove Account
  async removeAccount({ profileId }: { profileId: string }): Promise<{ success: boolean }> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Owner Override & Permission Assertions
    if (!session.isOwner) {
      await this.assertPermission(session.profile.id, "remove_students", "remove student accounts");
    }

    const profiles = localDB.getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new Error("Profile not found.");

    // Protection against removing owners/super owners
    if (profile.pending_role === 'super_owner') {
      throw new Error("Security Lock: Super Owners cannot be removed.");
    }
    if (profile.pending_role === 'owner' && !session.isSuperOwner) {
      throw new Error("Access denied. Only the Super Owner can remove other Owners.");
    }

    const oldUsername = profile.username;
    
    // Soft remove: set status to 'removed', keep the profile so Owner can restore it
    profile.status = 'removed';
    const userId = profile.user_id;
    profile.user_id = null;
    profile.password_set = false;
    localDB.save();

    if (userId) {
      const roles = localDB.getUserRoles();
      localDB.setUserRoles(roles.filter(r => r.user_id !== userId));

      const passwords = JSON.parse(localStorage.getItem("classvault_passwords") || "{}");
      const email = usernameToEmail(oldUsername);
      delete passwords[email];
      localStorage.setItem("classvault_passwords", JSON.stringify(passwords));
    }

    // Log Action
    await this.logAdminAction(
      session.profile.id,
      "Remove Account",
      `Soft-removed account for student "${oldUsername}".`
    );

    return { success: true };
  },

  // Suspend Account (Now forces student into Read-Only Mode)
  async suspendAccount({ profileId, days, reason }: { profileId: string; days: number; reason: string }): Promise<Profile> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Owner Override & Permission Assertions
    if (!session.isOwner) {
      await this.assertPermission(session.profile.id, "suspend_students", "suspend student accounts");
    }

    const profiles = localDB.getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new Error("Profile not found.");

    if (profile.pending_role === 'super_owner') {
      throw new Error("Security Lock: Super Owners cannot be suspended.");
    }
    if (profile.pending_role === 'owner' && !session.isSuperOwner) {
      throw new Error("Access denied. Owners can only be suspended by the Super Owner.");
    }

    const suspendedUntil = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    
    profile.status = 'suspended';
    profile.suspended_until = suspendedUntil;
    profile.suspension_reason = reason || "Suspended by administrator.";
    localDB.save();

    // Create warning
    await this.warnAccount({ 
      profileId, 
      message: `Your account has been suspended (Read-Only Mode Active) for ${days} days until ${new Date(suspendedUntil).toLocaleString()}. Reason: ${profile.suspension_reason}` 
    });

    // Log Action
    await this.logAdminAction(
      session.profile.id,
      "Suspend Account",
      `Suspended "${profile.username}" for ${days} days (Reason: ${profile.suspension_reason}).`
    );

    return profile;
  },

  // Unsuspend Account
  async unsuspendAccount({ profileId }: { profileId: string }): Promise<Profile> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Owner Override & Permission Assertions
    if (!session.isOwner) {
      await this.assertPermission(session.profile.id, "unsuspend_students", "unsuspend student accounts");
    }

    const profiles = localDB.getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new Error("Profile not found.");

    profile.status = 'active';
    profile.suspended_until = null;
    profile.suspension_reason = null;
    localDB.save();

    // Log Action
    await this.logAdminAction(
      session.profile.id,
      "Unsuspend Account",
      `Lifted suspension for student "${profile.username}".`
    );

    return profile;
  },

  // Warn Account
  async warnAccount({ profileId, message }: { profileId: string; message: string }): Promise<Warning> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Owner Override & Permission Assertions
    if (!session.isOwner) {
      await this.assertPermission(session.profile.id, "send_warnings", "issue student warning notices");
    }

    const newWarning: Warning = {
      id: generateUUID(),
      profile_id: profileId,
      message: message.trim(),
      read: false,
      created_at: new Date().toISOString()
    };

    localDB.setWarnings([...localDB.getWarnings(), newWarning]);

    // Log Action
    const profiles = localDB.getProfiles();
    const target = profiles.find(p => p.id === profileId);
    await this.logAdminAction(
      session.profile.id,
      "Warn Account",
      `Issued behavioral warning to student "${target?.username ?? 'Unknown'}".`
    );

    return newWarning;
  },

  // Change Username
  async changeUsername({ profileId, newUsername }: { profileId: string; newUsername: string }): Promise<Profile> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Owner Override & Permission Assertions
    if (!session.isOwner) {
      await this.assertPermission(session.profile.id, "edit_students", "rename student accounts");
    }

    if (!isValidUsername(newUsername)) {
      throw new Error("Invalid username format.");
    }

    const profiles = localDB.getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) throw new Error("Profile not found.");

    const existing = profiles.find(p => p.username.toLowerCase() === newUsername.toLowerCase() && p.id !== profileId);
    if (existing) throw new Error("Username already taken.");

    const oldUsername = profile.username;
    profile.username = newUsername.trim();
    localDB.save();

    // Migrate passwords
    const passwords = JSON.parse(localStorage.getItem("classvault_passwords") || "{}");
    const oldEmail = usernameToEmail(oldUsername);
    const newEmail = usernameToEmail(newUsername);
    if (passwords[oldEmail]) {
      passwords[newEmail] = passwords[oldEmail];
      delete passwords[oldEmail];
      localStorage.setItem("classvault_passwords", JSON.stringify(passwords));
    }

    // Log Action
    await this.logAdminAction(
      session.profile.id,
      "Force Rename",
      `Force renamed student "${oldUsername}" to "${newUsername}".`
    );

    return profile;
  },

  // Resolve Username Request
  async resolveUsernameRequest({ requestId, approve, note }: { requestId: string; approve: boolean; note: string | null }): Promise<UsernameRequest> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Owner Override & Permission Assertions
    if (!session.isOwner) {
      if (approve) {
        await this.assertPermission(session.profile.id, "approve_username_requests", "approve rename requests");
      } else {
        await this.assertPermission(session.profile.id, "reject_username_requests", "reject rename requests");
      }
    }

    const requests = localDB.getUsernameRequests();
    const request = requests.find(r => r.id === requestId);
    if (!request) throw new Error("Request not found.");

    request.status = approve ? 'approved' : 'rejected';
    request.admin_note = note;
    request.resolved_at = new Date().toISOString();
    localDB.save();

    const profiles = localDB.getProfiles();
    const profile = profiles.find(p => p.id === request.profile_id);

    if (approve && profile) {
      const oldUsername = profile.username;
      const newUsername = request.requested_username;

      const taken = profiles.find(p => p.username.toLowerCase() === newUsername.toLowerCase() && p.id !== profile.id);
      if (taken) {
        request.status = 'rejected';
        request.admin_note = "Approved username is now taken by another user.";
        localDB.save();
        throw new Error("The requested username is no longer available.");
      }

      profile.username = newUsername;
      localDB.save();

      // Migrate passwords
      const passwords = JSON.parse(localStorage.getItem("classvault_passwords") || "{}");
      const oldEmail = usernameToEmail(oldUsername);
      const newEmail = usernameToEmail(newUsername);
      if (passwords[oldEmail]) {
        passwords[newEmail] = passwords[oldEmail];
        delete passwords[oldEmail];
        localStorage.setItem("classvault_passwords", JSON.stringify(passwords));
      }

      await this.warnAccount({
        profileId: profile.id,
        message: `Your request to change username to "${newUsername}" was APPROVED. Note: ${note || "None"}`
      });

      // Log Action
      await this.logAdminAction(
        session.profile.id,
        "Approve Rename",
        `Approved rename request: "${oldUsername}" changed to "${newUsername}".`
      );
    } else if (profile) {
      await this.warnAccount({
        profileId: profile.id,
        message: `Your request to change username to "${request.requested_username}" was REJECTED. Note: ${note || "None"}`
      });

      // Log Action
      await this.logAdminAction(
        session.profile.id,
        "Reject Rename",
        `Rejected rename request from "${profile.username}" for requested name "${request.requested_username}".`
      );
    }

    return request;
  },

  // Set App Settings (Feature flags / Emergency locks)
  async setSetting({ key, value }: { key: string; value: any }): Promise<AppSetting> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Owner Override & Permission Assertions
    if (!session.isOwner) {
      await this.assertPermission(session.profile.id, "manage_feature_toggles", "configure classroom feature toggles");
    }

    const settings = localDB.getAppSettings();
    let setting = settings.find(s => s.key === key);
    
    if (setting) {
      setting.value = value;
      setting.updated_at = new Date().toISOString();
    } else {
      setting = {
        key,
        value,
        updated_at: new Date().toISOString()
      };
      settings.push(setting);
    }

    localDB.setAppSettings([...settings]);

    // Log Action
    await this.logAdminAction(
      session.profile.id,
      "Update Setting",
      `Changed security setting "${key}" to "${value}".`
    );

    return setting;
  },

  // Resolve Report
  async resolveReport({ reportId }: { reportId: string }): Promise<Report> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Owner Override & Permission Assertions
    if (!session.isOwner) {
      await this.assertPermission(session.profile.id, "resolve_reports", "resolve content flags/reports");
    }

    const reports = localDB.getReports();
    const report = reports.find(r => r.id === reportId);
    if (!report) throw new Error("Report not found.");

    report.status = 'resolved';
    localDB.save();

    // Log Action
    await this.logAdminAction(
      session.profile.id,
      "Resolve Report",
      `Resolved student behavior flag report (Report ID: ${reportId.substring(0, 8)}).`
    );

    return report;
  },

  // --- Owner/Admin Queries ---
  
  // Get All Profiles (SILENT GOVERNANCE: Owners/Super Owners are hidden from standard admins)
  async getAdminProfiles(): Promise<Profile[]> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    const profiles = localDB.getProfiles();
    
    // Return all profiles sorted
    return profiles
      .filter(p => {
        // Owners/Super Owners can see everyone
        if (session.isOwner) return true;
        // Standard admins cannot see Owner or Super Owner accounts (Silent Governance)
        return !['owner', 'super_owner'].includes(p.pending_role);
      })
      .sort((a, b) => a.username.localeCompare(b.username));
  },

  // Get All Messages (raw feed showing actual sender)
  async getAdminMessages(): Promise<Message[]> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Permission assertion for standard admins
    const isOwnerBypass = session.isOwner;
    const canViewDMs = isOwnerBypass ? true : await this.hasPermission(session.profile.id, "view_direct_messages");
    const canViewBroadcasts = isOwnerBypass ? true : await this.hasPermission(session.profile.id, "view_broadcasts");
    const canViewAnon = isOwnerBypass ? true : await this.hasPermission(session.profile.id, "view_anonymous_identities");

    const messages = localDB.getMessages();
    const profiles = localDB.getProfiles();

    // Filter messages based on admin permissions
    const filtered = messages.filter(m => {
      if (m.recipient_id === null) {
        return canViewBroadcasts;
      } else {
        return canViewDMs;
      }
    });

    const result = filtered.map(m => {
      const sender = profiles.find(p => p.id === m.sender_id);
      const recipient = m.recipient_id ? profiles.find(p => p.id === m.recipient_id) : null;

      // Determine real sender display based on anonymous permissions
      const revealSender = isOwnerBypass || canViewAnon || !m.sender_anonymous;

      return {
        ...m,
        sender_username: revealSender ? (sender?.username ?? "Unknown") : "Anonymous",
        sender_anonymous: sender?.anonymous ?? false,
        recipient_username: recipient?.username ?? undefined
      };
    });

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  },

  // Get All Reports
  async getAdminReports(): Promise<Report[]> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    if (!session.isOwner) {
      await this.assertPermission(session.profile.id, "handle_reports", "view or handle flagged reports");
    }

    const reports = localDB.getReports();
    const profiles = localDB.getProfiles();
    const messages = localDB.getMessages();

    const result = reports.map(r => {
      const reporter = profiles.find(p => p.id === r.reporter_id);
      const msg = messages.find(m => m.id === r.message_id);
      const msgSender = msg ? profiles.find(p => p.id === msg.sender_id) : null;

      return {
        ...r,
        reporter_username: reporter?.username ?? "Unknown",
        message_content: msg?.content ?? "[Message Deleted]",
        message_sender_username: msgSender?.username ?? "Unknown",
        message_sender_anonymous: msgSender?.anonymous ?? false,
        message_file_name: msg?.file_name ?? null,
        message_recipient_id: msg?.recipient_id ?? null
      };
    });

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  },

  // Get All Username Requests
  async getAdminUsernameRequests(): Promise<UsernameRequest[]> {
    const session = this.getSession();
    if (!session || !session.isAdmin) throw new Error("Access denied.");

    // Standard admins must have at least one request permission to view
    if (!session.isOwner) {
      const canApprove = await this.hasPermission(session.profile.id, "approve_username_requests");
      const canReject = await this.hasPermission(session.profile.id, "reject_username_requests");
      if (!canApprove && !canReject) {
        throw new Error("Access denied. You do not have permission to view username requests.");
      }
    }

    const requests = localDB.getUsernameRequests();
    const profiles = localDB.getProfiles();

    const result = requests.map(r => {
      const profile = profiles.find(p => p.id === r.profile_id);
      return {
        ...r,
        current_username: profile?.username ?? "Unknown"
      };
    });

    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  },

  // Get Admin Activity Logs (Owner Only query)
  async getAdminActivityLogs(): Promise<AdminActivityLog[]> {
    const session = this.getSession();
    if (!session || !session.isOwner) {
      throw new Error("Access denied. Owner-only audit trail logs.");
    }
    return localDB.getAdminActivityLogs();
  },

  // Get Admin Permissions (Owner Only query)
  getAdminPermissions(): AdminPermission[] {
    const session = this.getSession();
    if (!session || !session.isOwner) {
      throw new Error("Access denied. Owner-only permissions query.");
    }
    return localDB.getAdminPermissions();
  },

  // Helper to read file from mock storage
  getMockFileUrl(filePath: string): string {
    const fileStore = JSON.parse(localStorage.getItem("classvault_files") || "{}");
    return fileStore[filePath] || "";
  }
};

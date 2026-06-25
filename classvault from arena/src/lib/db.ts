import { supabase, usernameToEmail, emailToUsername } from './supabase';
import type { 
  Profile, 
  Message, 
  Report, 
  Warning, 
  UsernameRequest, 
  AppSettings,
  Session,
  UserRole
} from '../types/db';

// Helper to handle Supabase errors
function handleError(error: any): never {
  console.error('Database error:', error);
  throw new Error(error.message || 'Database operation failed');
}

// Helper to get profile from session
async function getProfileFromSession(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();
  
  if (error) return null;
  return data as Profile;
}

// ============ Session Management ============

export async function getSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  
  const profile = await getProfileFromSession();
  if (!profile) return null;
  
  return {
    user: {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name || profile.username,
      role: profile.role as UserRole,
      email: profile.email || session.user.email || '',
      permissions: profile.permissions || []
    },
    token: session.access_token
  };
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (session) {
        const profile = await getProfileFromSession();
        if (profile) {
          callback({
            user: {
              id: profile.id,
              username: profile.username,
              displayName: profile.display_name || profile.username,
              role: profile.role as UserRole,
              email: profile.email || session.user.email || '',
              permissions: profile.permissions || []
            },
            token: session.access_token
          });
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    }
  );
  
  return () => subscription.unsubscribe();
}

// ============ Authentication ============

export async function login(username: string, password: string): Promise<Session> {
  const email = usernameToEmail(username);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) handleError(error);
  
  const profile = await getProfileFromSession();
  if (!profile) throw new Error('Profile not found');
  
  return {
    user: {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name || profile.username,
      role: profile.role as UserRole,
      email: profile.email || data.user.email || '',
      permissions: profile.permissions || []
    },
    token: data.session.access_token
  };
}

export async function claimAccount(username: string, password: string): Promise<Session> {
  // First, find the profile
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .eq('password_set', false);
  
  if (profileError) handleError(profileError);
  if (!profiles || profiles.length === 0) {
    throw new Error('Username not found or already claimed');
  }
  
  const profile = profiles[0];
  const email = usernameToEmail(username);
  
  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: profile.username,
        display_name: profile.display_name,
        role: profile.role
      }
    }
  });
  
  if (authError) handleError(authError);
  if (!authData.user) throw new Error('Failed to create user');
  
  // Update profile with auth_user_id and password_set
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      auth_user_id: authData.user.id,
      password_set: true,
      email: email
    })
    .eq('id', profile.id);
  
  if (updateError) handleError(updateError);
  
  // Login the user
  const session = await login(username, password);
  
  // Dispatch update event for other tabs
  window.dispatchEvent(new CustomEvent('classvault-db-update', { 
    detail: { type: 'claim', username, profile: session.user }
  }));
  
  return session;
}

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) handleError(error);
}

export async function getCurrentUser(): Promise<Profile | null> {
  return await getProfileFromSession();
}

// ============ Profiles ============

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('username');
  
  if (error) handleError(error);
  return data as Profile[];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  return data as Profile;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();
  
  if (error) return null;
  return data as Profile;
}

export async function createProfile(profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert([{
      username: profile.username,
      display_name: profile.display_name,
      role: profile.role,
      password_set: false,
      permissions: profile.permissions || []
    }])
    .select()
    .single();
  
  if (error) handleError(error);
  
  // Dispatch update event
  window.dispatchEvent(new CustomEvent('classvault-db-update', { 
    detail: { type: 'create', profile: data }
  }));
  
  return data as Profile;
}

export async function updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: updates.display_name,
      role: updates.role,
      permissions: updates.permissions
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) handleError(error);
  
  window.dispatchEvent(new CustomEvent('classvault-db-update', { 
    detail: { type: 'update', profile: data }
  }));
  
  return data as Profile;
}

export async function deleteProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id);
  
  if (error) handleError(error);
  
  window.dispatchEvent(new CustomEvent('classvault-db-update', { 
    detail: { type: 'delete', id }
  }));
}

// ============ Messages ============

export async function getMessages(options?: { 
  senderId?: string; 
  recipientId?: string; 
  parentId?: string | null;
}): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (options?.senderId) {
    query = query.eq('sender_id', options.senderId);
  }
  if (options?.recipientId) {
    query = query.eq('recipient_id', options.recipientId);
  }
  if (options?.parentId !== undefined) {
    query = query.is('parent_id', options.parentId);
  }
  
  const { data, error } = await query;
  if (error) handleError(error);
  return data as Message[];
}

export async function getMessage(id: string): Promise<Message | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  return data as Message;
}

export async function createMessage(message: Omit<Message, 'id' | 'created_at' | 'updated_at'>): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert([{
      sender_id: message.sender_id,
      recipient_id: message.recipient_id,
      content: message.content,
      file_url: message.file_url,
      file_name: message.file_name,
      file_type: message.file_type,
      is_read: message.is_read || false,
      parent_id: message.parent_id || null
    }])
    .select()
    .single();
  
  if (error) handleError(error);
  
  window.dispatchEvent(new CustomEvent('classvault-db-update', { 
    detail: { type: 'message', message: data }
  }));
  
  return data as Message;
}

export async function updateMessage(id: string, updates: Partial<Message>): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .update({
      content: updates.content,
      is_read: updates.is_read
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) handleError(error);
  return data as Message;
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', id);
  
  if (error) handleError(error);
}

export async function getConversation(userId1: string, userId2: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId1},recipient_id.eq.${userId2}),and(sender_id.eq.${userId2},recipient_id.eq.${userId1})`)
    .order('created_at', { ascending: true });
  
  if (error) handleError(error);
  return data as Message[];
}

// ============ Reports ============

export async function getReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) handleError(error);
  return data as Report[];
}

export async function getReport(id: string): Promise<Report | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  return data as Report;
}

export async function createReport(report: Omit<Report, 'id' | 'created_at' | 'updated_at'>): Promise<Report> {
  const { data, error } = await supabase
    .from('reports')
    .insert([{
      created_by: report.created_by,
      student_id: report.student_id,
      title: report.title,
      description: report.description,
      grade: report.grade,
      status: report.status || 'draft',
      file_url: report.file_url
    }])
    .select()
    .single();
  
  if (error) handleError(error);
  return data as Report;
}

export async function updateReport(id: string, updates: Partial<Report>): Promise<Report> {
  const { data, error } = await supabase
    .from('reports')
    .update({
      title: updates.title,
      description: updates.description,
      grade: updates.grade,
      status: updates.status,
      file_url: updates.file_url
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) handleError(error);
  return data as Report;
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', id);
  
  if (error) handleError(error);
}

// ============ Warnings ============

export async function getWarnings(): Promise<Warning[]> {
  const { data, error } = await supabase
    .from('warnings')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) handleError(error);
  return data as Warning[];
}

export async function getWarning(id: string): Promise<Warning | null> {
  const { data, error } = await supabase
    .from('warnings')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) return null;
  return data as Warning;
}

export async function createWarning(warning: Omit<Warning, 'id' | 'created_at' | 'updated_at'>): Promise<Warning> {
  const { data, error } = await supabase
    .from('warnings')
    .insert([{
      student_id: warning.student_id,
      created_by: warning.created_by,
      title: warning.title,
      description: warning.description,
      type: warning.type,
      is_resolved: warning.is_resolved || false
    }])
    .select()
    .single();
  
  if (error) handleError(error);
  return data as Warning;
}

export async function updateWarning(id: string, updates: Partial<Warning>): Promise<Warning> {
  const { data, error } = await supabase
    .from('warnings')
    .update({
      title: updates.title,
      description: updates.description,
      type: updates.type,
      is_resolved: updates.is_resolved
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) handleError(error);
  return data as Warning;
}

export async function deleteWarning(id: string): Promise<void> {
  const { error } = await supabase
    .from('warnings')
    .delete()
    .eq('id', id);
  
  if (error) handleError(error);
}

// ============ Username Requests ============

export async function getUsernameRequests(): Promise<UsernameRequest[]> {
  const { data, error } = await supabase
    .from('username_requests')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) handleError(error);
  return data as UsernameRequest[];
}

export async function createUsernameRequest(
  request: Omit<UsernameRequest, 'id' | 'created_at' | 'updated_at'>
): Promise<UsernameRequest> {
  const { data, error } = await supabase
    .from('username_requests')
    .insert([{
      requested_by: request.requested_by,
      requested_username: request.requested_username,
      status: 'pending',
      reason: request.reason
    }])
    .select()
    .single();
  
  if (error) handleError(error);
  return data as UsernameRequest;
}

export async function updateUsernameRequest(
  id: string, 
  updates: Partial<UsernameRequest>
): Promise<UsernameRequest> {
  const { data, error } = await supabase
    .from('username_requests')
    .update({
      status: updates.status,
      reviewed_by: updates.reviewed_by,
      reviewed_at: updates.reviewed_at ? new Date().toISOString() : undefined,
      reason: updates.reason
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) handleError(error);
  return data as UsernameRequest;
}

// ============ App Settings ============

export async function getAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*');
  
  if (error) handleError(error);
  
  // Convert array to object
  const settings: Record<string, any> = {};
  data.forEach(item => {
    settings[item.key] = item.value;
  });
  
  return settings as AppSettings;
}

export async function updateAppSetting(key: string, value: any): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString()
    });
  
  if (error) handleError(error);
}

// ============ Admin Functions ============

export async function getAdminProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'teacher'])
    .order('username');
  
  if (error) handleError(error);
  return data as Profile[];
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  return profile?.role === 'admin' || profile?.role === 'teacher';
}

// ============ Database Events ============

export function onDatabaseUpdate(callback: (event: any) => void): () => void {
  const handler = (event: CustomEvent) => {
    callback(event.detail);
  };
  
  window.addEventListener('classvault-db-update', handler as EventListener);
  return () => window.removeEventListener('classvault-db-update', handler as EventListener);
}

import React, { useState, useEffect, useRef, useCallback } from "react";
import { dbAPI, Message, GroupChat } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { MessageCard } from "@/components/MessageCard";
import { MessageComposer } from "@/components/MessageComposer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Search, MessageSquare, RefreshCw, EyeOff, ShieldAlert, Plus, 
  Users, Edit, Info, Check 
} from "lucide-react";
import { toast } from "sonner";

export const Direct: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  
  // Tabs: 'chats' (DMs) or 'groups' (WhatsApp groupchats)
  const [sidebarTab, setSidebarTab] = useState<"chats" | "groups">("chats");
  
  // Selection
  const [selectedClassmate, setSelectedClassmate] = useState<any | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupChat | null>(null);
  
  // Directory & Data
  const [classmates, setClassmates] = useState<any[]>([]);
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Permissions
  const [canManageGroups, setCanManageGroups] = useState(false);
  
  // Loading states
  const [isLoadingSidebar, setIsLoadingSidebar] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog States
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDialogMode, setGroupDialogMode] = useState<"create" | "edit">("create");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check group chat permission on mount/refresh
  const checkPermissions = useCallback(async () => {
    if (!profile) return;
    try {
      const allowed = await dbAPI.hasPermission(profile.id, "manage_group_chats");
      setCanManageGroups(allowed);
    } catch (e) {
      console.error("Failed to check group chat permissions", e);
    }
  }, [profile]);

  // Load classmate directory and groups
  const loadSidebarData = useCallback(async () => {
    try {
      const cData = await dbAPI.getPublicProfiles();
      setClassmates(cData);
      
      const gData = await dbAPI.getGroupChats();
      setGroups(gData);
      
      // Sync selected states if data changed
      if (selectedClassmate) {
        const updated = cData.find(c => c.id === selectedClassmate.id);
        if (updated) setSelectedClassmate(updated);
      }
      if (selectedGroup) {
        const updated = gData.find(g => g.id === selectedGroup.id);
        if (updated) setSelectedGroup(updated);
      }
    } catch (e: any) {
      console.error("Failed to load sidebar data", e);
      toast.error("Failed to load conversation list.");
    } finally {
      setIsLoadingSidebar(false);
    }
  }, [selectedClassmate, selectedGroup]);

  // Load conversation messages (handles either DM classmateId or Group groupId)
  const loadMessages = useCallback(async (classmateId: string | null, groupId: string | null, silent = false) => {
    if (!silent) setIsLoadingMessages(true);
    else setIsRefreshing(true);

    try {
      const data = await dbAPI.getMessages({ 
        recipientId: classmateId, 
        groupId: groupId 
      });
      // We want ascending order for chat logs so it reads naturally like a thread, reverse the default DESC
      setMessages([...data].reverse());
    } catch (e: any) {
      console.error("Failed to load messages", e);
      toast.error("Failed to load conversation history.");
    } finally {
      setIsLoadingMessages(false);
      setIsRefreshing(false);
    }
  }, []);

  // Sync / Initialize
  useEffect(() => {
    checkPermissions();
    loadSidebarData();
  }, [checkPermissions, loadSidebarData]);

  // Poll active chat or sidebar data and react instantly to local database updates
  useEffect(() => {
    const handleDbUpdate = () => {
      loadSidebarData();
      if (selectedClassmate) {
        loadMessages(selectedClassmate.id, null, true);
      } else if (selectedGroup) {
        loadMessages(null, selectedGroup.id, true);
      }
    };

    window.addEventListener("classvault-db-update", handleDbUpdate);

    const interval = setInterval(() => {
      loadSidebarData();
      if (selectedClassmate) {
        loadMessages(selectedClassmate.id, null, true);
      } else if (selectedGroup) {
        loadMessages(null, selectedGroup.id, true);
      }
    }, 10000); // Poll every 10s as a backup

    return () => {
      window.removeEventListener("classvault-db-update", handleDbUpdate);
      clearInterval(interval);
    };
  }, [selectedClassmate, selectedGroup, loadSidebarData, loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle switching sidebar tabs
  const handleTabChange = (tab: "chats" | "groups") => {
    setSidebarTab(tab);
    setSelectedClassmate(null);
    setSelectedGroup(null);
    setMessages([]);
    setSearchQuery("");
  };

  // Search filter for classmates or groups
  const filteredClassmates = classmates.filter(c => 
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group Members selection toggler
  const handleMemberToggle = (profileId: string) => {
    setSelectedMembers(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId) 
        : [...prev, profileId]
    );
  };

  // Open Create Group Dialog
  const handleOpenCreateGroup = () => {
    setGroupDialogMode("create");
    setGroupName("");
    setGroupDescription("");
    setSelectedMembers([]);
    setGroupDialogOpen(true);
  };

  // Open Edit Group Dialog
  const handleOpenEditGroup = () => {
    if (!selectedGroup) return;
    setGroupDialogMode("edit");
    setGroupName(selectedGroup.name);
    setGroupDescription(selectedGroup.description);
    // Creator is forced member, exclude them from editable members state just for safety
    setSelectedMembers(selectedGroup.members.filter(id => id !== selectedGroup.created_by));
    setGroupDialogOpen(true);
  };

  // Submit Create/Edit Group
  const handleSubmitGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Group name is required.");
      return;
    }

    setIsSubmittingGroup(true);
    try {
      if (groupDialogMode === "create") {
        const newGroup = await dbAPI.createGroupChat({
          name: groupName,
          description: groupDescription,
          members: selectedMembers
        });
        toast.success(`Group "${newGroup.name}" created successfully!`);
        setSelectedGroup(newGroup);
        setSelectedClassmate(null);
        loadMessages(null, newGroup.id);
      } else if (groupDialogMode === "edit" && selectedGroup) {
        const updated = await dbAPI.updateGroupChat({
          groupId: selectedGroup.id,
          name: groupName,
          description: groupDescription,
          members: selectedMembers
        });
        toast.success(`Group "${updated.name}" updated successfully!`);
        setSelectedGroup(updated);
        loadMessages(null, updated.id);
      }
      setGroupDialogOpen(false);
      loadSidebarData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save group.");
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  // Display name for the chat partner
  const getPartnerDisplayName = (partner: any) => {
    if (!partner) return "";
    if (partner.anonymous && !isAdmin) {
      return "Anonymous Classmate";
    }
    return partner.username;
  };

  // Render Sidebar Row: DM Chat
  const renderDMRow = (c: any) => {
    const isSelected = selectedClassmate?.id === c.id;
    const displayName = getPartnerDisplayName(c);
    
    return (
      <button
        key={c.id}
        onClick={() => {
          setSelectedClassmate(c);
          setSelectedGroup(null);
          loadMessages(c.id, null);
        }}
        className={`w-full text-left p-3 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer text-xs ${
          isSelected 
            ? "bg-primary/20 text-primary border border-primary/30 font-semibold" 
            : "hover:bg-muted/40 text-foreground/80 border border-transparent"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
            isSelected 
              ? "bg-primary/30 text-primary" 
              : c.anonymous
                ? "bg-accent/15 text-accent"
                : "bg-muted text-muted-foreground"
          }`}>
            {c.anonymous && !isAdmin ? "??" : c.username.substring(0,2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">
              {c.anonymous ? "Anonymous mode" : "Public profile"}
            </p>
          </div>
        </div>
        
        {c.anonymous && (
          <span title="User is anonymous to classmates">
            <EyeOff className="h-3 w-3 text-accent shrink-0" />
          </span>
        )}
      </button>
    );
  };

  // Render Sidebar Row: Group Chat
  const renderGroupRow = (g: GroupChat) => {
    const isSelected = selectedGroup?.id === g.id;
    
    return (
      <button
        key={g.id}
        onClick={() => {
          setSelectedGroup(g);
          setSelectedClassmate(null);
          loadMessages(null, g.id);
        }}
        className={`w-full text-left p-3 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer text-xs ${
          isSelected 
            ? "bg-primary/20 text-primary border border-primary/30 font-semibold" 
            : "hover:bg-muted/40 text-foreground/80 border border-transparent"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${g.avatar_color}`}>
            <Users className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate text-foreground">{g.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {g.description || `${g.members.length} members`}
            </p>
          </div>
        </div>
        
        <Badge variant="secondary" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
          {g.members.length}
        </Badge>
      </button>
    );
  };

  return (
    <div className="glass rounded-xl border border-border/50 h-[calc(100vh-140px)] min-h-[500px] flex overflow-hidden select-none">
      
      {/* Left Sidebar: DMs vs Groups */}
      <div className="w-80 border-r border-border/50 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-border/40 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Classroom Vault Chat
            </h2>
            
            {/* New Group button (WhatsApp Groupchat creation) */}
            {sidebarTab === "groups" && canManageGroups && (
              <Button 
                size="sm" 
                variant="accent" 
                onClick={handleOpenCreateGroup}
                className="h-7 px-2.5 text-[10px] cursor-pointer gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> New Group
              </Button>
            )}
          </div>
          
          {/* Chats vs Groups Selector Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-muted p-0.5 rounded-md text-[11px] font-semibold">
            <button
              onClick={() => handleTabChange("chats")}
              className={`py-1 rounded text-center cursor-pointer transition-colors ${
                sidebarTab === "chats" 
                  ? "bg-background text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Direct DMs
            </button>
            <button
              onClick={() => handleTabChange("groups")}
              className={`py-1 rounded text-center cursor-pointer transition-colors ${
                sidebarTab === "groups" 
                  ? "bg-background text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Group Chats
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={sidebarTab === "chats" ? "Search classmates..." : "Search group chats..."}
              className="w-full text-xs rounded-md border border-border bg-input pl-8 pr-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoadingSidebar ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Loading directories...
            </div>
          ) : sidebarTab === "chats" ? (
            filteredClassmates.length > 0 ? (
              filteredClassmates.map(renderDMRow)
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">No classmates found.</div>
            )
          ) : (
            filteredGroups.length > 0 ? (
              filteredGroups.map(renderGroupRow)
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">No group chats found.</div>
            )
          )}
        </div>
      </div>

      {/* Right Pane: Active Conversation */}
      <div className="flex-1 flex flex-col h-full bg-muted/5">
        {selectedClassmate || selectedGroup ? (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-border/40 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3 min-w-0">
                {selectedClassmate ? (
                  // DM Header
                  <>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      selectedClassmate.anonymous ? "bg-accent/15 text-accent border border-accent/20" : "bg-primary/20 text-primary border border-primary/25"
                    }`}>
                      {selectedClassmate.anonymous && !isAdmin ? "??" : selectedClassmate.username.substring(0,2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {getPartnerDisplayName(selectedClassmate)}
                      </h3>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">
                          {selectedClassmate.anonymous ? "Privacy Mode Active" : "Public Identity"}
                        </span>
                        {isAdmin && selectedClassmate.anonymous && (
                          <span className="text-[10px] text-destructive font-semibold ml-1 shrink-0 flex items-center gap-0.5 animate-pulse">
                            <ShieldAlert className="h-2.5 w-2.5" /> Admin reveals: {selectedClassmate.username}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  // Group Header (WhatsApp-like)
                  <>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${selectedGroup!.avatar_color}`}>
                      <Users className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {selectedGroup!.name}
                        </h3>
                        {canManageGroups && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleOpenEditGroup}
                            className="h-6 w-6 text-muted-foreground hover:text-primary shrink-0 cursor-pointer"
                            title="Edit Group Details & Members"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
                        <Info className="h-3 w-3 shrink-0" />
                        <span className="truncate italic">
                          {selectedGroup!.description || "No description set."}
                        </span>
                        <span className="shrink-0 font-medium bg-muted px-1.5 py-0.5 rounded text-[9px]">
                          {selectedGroup!.members.length} Members
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => loadMessages(selectedClassmate ? selectedClassmate.id : null, selectedGroup ? selectedGroup.id : null, true)}
                disabled={isRefreshing}
                className="h-8 w-8 text-muted-foreground cursor-pointer shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Conversation Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full space-y-2">
                  <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground">Loading chat history...</p>
                </div>
              ) : messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <MessageCard 
                      key={msg.id} 
                      message={msg} 
                      showRecipient={false} 
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold text-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs mt-1">
                    {selectedClassmate 
                      ? `Send a private note or resource file to ${getPartnerDisplayName(selectedClassmate)}.`
                      : `Be the first to share notes or start a discussion in "${selectedGroup!.name}".`}
                  </p>
                </div>
              )}
            </div>

            {/* Conversation Composer */}
            <div className="p-4 border-t border-border/40 bg-muted/10">
              <MessageComposer
                mode="direct"
                recipientId={selectedClassmate ? selectedClassmate.id : null}
                parentId={null}
                placeholder={
                  selectedClassmate 
                    ? `Send a private message to ${getPartnerDisplayName(selectedClassmate)}...`
                    : `Send a message to "${selectedGroup!.name}" study circle...`
                }
                onSuccess={() => loadMessages(selectedClassmate ? selectedClassmate.id : null, selectedGroup ? selectedGroup.id : null, true)}
              />
            </div>
          </>
        ) : (
          /* Welcome/Empty State Pane */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 border border-primary/20 animate-pulse">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground font-display">Collaborative Vault Study Chats</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Connect with classmates in private one-on-one DMs, or join structured study groups to share notes, syllabi, and practice problems.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSidebarTab("chats")}
                className="text-xs font-semibold cursor-pointer"
              >
                Open Classmates Directory
              </Button>
              <Button 
                variant="accent" 
                size="sm" 
                onClick={() => setSidebarTab("groups")}
                className="text-xs font-semibold cursor-pointer"
              >
                Browse Study Groups
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT GROUP CHAT DIALOG */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <Users className="h-5 w-5 text-primary" /> 
              {groupDialogMode === "create" ? "Create Study Group Chat" : `Edit "${selectedGroup?.name}"`}
            </DialogTitle>
            <DialogDescription>
              {groupDialogMode === "create"
                ? "Form a WhatsApp-like classroom group chat for structured study discussions and note sharing."
                : "Modify group details or update participant membership list."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitGroup} className="space-y-4 my-2">
            
            {/* Name input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Calculus Study Circle"
                required
                disabled={isSubmittingGroup}
                className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Description input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Description</label>
              <textarea
                rows={2}
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="e.g. Solving limits homework and preparing for the midterm exam..."
                disabled={isSubmittingGroup}
                className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Members selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border/45 pb-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Select Classmates ({selectedMembers.length} selected)</label>
                <span className="text-[10px] text-muted-foreground italic">Creator is automatically included</span>
              </div>
              
              <div className="max-h-48 overflow-y-auto border border-border/60 rounded-md p-2 bg-input/50 space-y-1">
                {classmates.map((c) => {
                  const isChecked = selectedMembers.includes(c.id);
                  const isCreator = groupDialogMode === "edit" && selectedGroup?.created_by === c.id;
                  
                  if (isCreator) return null; // Hide creator from selection since they can't be removed

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleMemberToggle(c.id)}
                      className="w-full flex items-center justify-between text-left p-1.5 rounded hover:bg-muted/50 transition-colors text-xs cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[9px] ${
                          c.anonymous ? "bg-accent/15 text-accent" : "bg-primary/20 text-primary"
                        }`}>
                          {c.anonymous && !isAdmin ? "??" : c.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">
                            {c.anonymous && !isAdmin ? "Anonymous Classmate" : c.username}
                          </span>
                          {c.anonymous && (
                            <span className="text-[9px] text-accent font-semibold ml-1.5">(Anonymous mode)</span>
                          )}
                        </div>
                      </div>
                      
                      {isChecked ? (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <span className="h-4 w-4 border border-border rounded shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setGroupDialogOpen(false)} disabled={isSubmittingGroup}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingGroup || !groupName.trim()}>
                {isSubmittingGroup ? "Saving..." : groupDialogMode === "create" ? "Create Group" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};

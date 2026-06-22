import React, { useState, useEffect, useCallback } from "react";
import { dbAPI, Message } from "@/lib/db";
import { MessageCard } from "@/components/MessageCard";
import { MessageComposer } from "@/components/MessageComposer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, RefreshCw, Radio, FileQuestion } from "lucide-react";
import { toast } from "sonner";

export const Feed: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Reply Modal state
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);

  // Fetch broadcasts
  const fetchBroadcasts = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    
    try {
      const data = await dbAPI.getMessages({ recipientId: null, limit: 100 });
      setMessages(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load class broadcasts.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Set up polling (refetch every 15 seconds) and reactive database listener
  useEffect(() => {
    fetchBroadcasts();
    
    const handleDbUpdate = () => {
      fetchBroadcasts(true);
    };
    
    window.addEventListener("classvault-db-update", handleDbUpdate);
    
    const interval = setInterval(() => {
      fetchBroadcasts(true);
    }, 15000);

    return () => {
      window.removeEventListener("classvault-db-update", handleDbUpdate);
      clearInterval(interval);
    };
  }, [fetchBroadcasts]);

  // Filter messages based on search query
  const filteredMessages = messages.filter((msg) => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const matchesContent = msg.content.toLowerCase().includes(query);
    const matchesSender = msg.sender_username?.toLowerCase().includes(query);
    const matchesFile = msg.file_name?.toLowerCase().includes(query);
    
    // Also search replies
    const matchesReplies = msg.replies?.some(r => 
      r.content.toLowerCase().includes(query) || 
      r.sender_username?.toLowerCase().includes(query)
    );

    return matchesContent || matchesSender || matchesFile || matchesReplies;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-1 sm:px-4 py-2 select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary animate-pulse" /> Class Broadcasts
          </h1>
          <p className="text-sm text-muted-foreground">
            Share study guides, ask homework questions, or broadcast updates anonymously.
          </p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchBroadcasts(true)}
          disabled={isRefreshing || isLoading}
          className="cursor-pointer gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh Feed"}
        </Button>
      </div>

      {/* Broadcast Composer */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
          Create Broadcast
        </h2>
        <MessageComposer 
          mode="broadcast" 
          placeholder="Anyone has Physics Ch 3 notes? Share them here! Or ask a question..." 
          onSuccess={() => fetchBroadcasts(true)} 
        />
      </div>

      {/* Search and List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
            Broadcast Stream
          </h2>
          
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts or files..."
              className="w-full text-xs rounded-md border border-border bg-input pl-8 pr-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Message Feed */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Opening the class vault...</p>
          </div>
        ) : filteredMessages.length > 0 ? (
          <div className="space-y-4">
            {filteredMessages.map((msg) => (
              <MessageCard 
                key={msg.id} 
                message={msg} 
                onReply={(target) => setReplyTarget(target)} 
              />
            ))}
          </div>
        ) : (
          <div className="glass rounded-lg p-12 flex flex-col items-center justify-center text-center border-dashed border border-border/60">
            <FileQuestion className="h-10 w-10 mb-3 text-muted-foreground/60" />
            <p className="text-base font-semibold text-foreground">
              {searchQuery ? "No matches found" : "Vault is empty"}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {searchQuery 
                ? "Try searching for a different keyword or file name." 
                : "No broadcasts have been posted yet. Be the first to share notes or ask a question!"}
            </p>
          </div>
        )}
      </div>

      {/* Reply Modal */}
      <Dialog open={replyTarget !== null} onOpenChange={(open) => !open && setReplyTarget(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Reply to Thread</DialogTitle>
            <DialogDescription>
              Add a reply to this broadcast message.
            </DialogDescription>
          </DialogHeader>

          {replyTarget && (
            <div className="space-y-4 mt-2">
              {/* Context message */}
              <div className="p-3 rounded bg-muted/30 border border-border/40 text-xs max-h-32 overflow-y-auto">
                <p className="font-semibold text-primary mb-1">
                  {replyTarget.sender_anonymous ? "Anonymous classmate" : replyTarget.sender_username}
                </p>
                <p className="text-muted-foreground whitespace-pre-wrap">{replyTarget.content}</p>
              </div>

              {/* Composer */}
              <MessageComposer
                mode="broadcast"
                parentId={replyTarget.id}
                placeholder="Type your reply here..."
                onSuccess={() => {
                  setReplyTarget(null);
                  fetchBroadcasts(true);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

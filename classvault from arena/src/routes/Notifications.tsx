import React, { useState, useEffect, useCallback } from "react";
import { dbAPI, Warning, UsernameRequest } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertOctagon, CheckCircle2, Inbox, RefreshCw, UserCheck, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";

export const Notifications: React.FC = () => {
  const { refreshProfile } = useAuth();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [requests, setRequests] = useState<UsernameRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch notifications
  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    
    try {
      const wData = await dbAPI.getWarnings();
      const rData = await dbAPI.getMyUsernameRequests();
      setWarnings(wData);
      setRequests(rData);
    } catch (e: any) {
      console.error("Failed to load notifications", e);
      toast.error("Failed to load notifications.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const handleDbUpdate = () => {
      loadNotifications(true);
    };

    window.addEventListener("classvault-db-update", handleDbUpdate);

    return () => {
      window.removeEventListener("classvault-db-update", handleDbUpdate);
    };
  }, [loadNotifications]);

  // Acknowledge Warning
  const handleAcknowledge = async (warningId: string) => {
    try {
      await dbAPI.markWarningRead({ warningId });
      toast.success("Warning acknowledged.");
      
      // Update local state directly to be snappy
      setWarnings(prev => 
        prev.map(w => w.id === warningId ? { ...w, read: true } : w)
      );
      
      // Refresh profile and other states
      refreshProfile();
    } catch (e: any) {
      toast.error(e.message || "Failed to acknowledge warning.");
    }
  };

  const unreadWarnings = warnings.filter(w => !w.read);
  const readWarnings = warnings.filter(w => w.read);

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-1 sm:px-4 py-2 select-none">
      
      {/* Header Banner */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" /> Notification Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Review administrator notices, warnings, and track your username requests.
          </p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => loadNotifications(true)}
          disabled={isRefreshing || isLoading}
          className="cursor-pointer gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading inbox...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Warnings Section (Takes 2/3 cols) */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <MessageSquareWarning className="h-4 w-4 text-warning" /> Administrator Notices & Warnings
            </h2>

            {/* Unread Warnings */}
            {unreadWarnings.length > 0 && (
              <div className="space-y-3">
                {unreadWarnings.map((w) => (
                  <div 
                    key={w.id} 
                    className="glass border-l-4 border-l-warning rounded-lg p-4 sm:p-5 bg-warning/5 space-y-3 shadow-lg shadow-warning/5 animate-pulse"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <AlertOctagon className="h-5 w-5 text-warning shrink-0" />
                        <span className="text-sm font-bold text-warning uppercase tracking-wider">
                          Urgent Attention Required
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(w.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                      {w.message}
                    </p>
                    
                    <div className="pt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="accent"
                        onClick={() => handleAcknowledge(w.id)}
                        className="cursor-pointer text-xs"
                      >
                        Acknowledge Notice
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Read / Past Warnings */}
            {readWarnings.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider pl-1">
                  Acknowledged Notices
                </h3>
                {readWarnings.map((w) => (
                  <div 
                    key={w.id} 
                    className="glass border-l-4 border-l-muted rounded-lg p-4 bg-muted/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span className="text-xs text-success font-semibold">Acknowledged</span>
                      </div>
                      <p className="text-xs text-foreground/80">{w.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(w.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {warnings.length === 0 && (
              <div className="glass rounded-lg p-8 text-center border-dashed border border-border/60">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                <p className="text-sm font-semibold text-foreground">Clean Moderation Record</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-0.5">
                  Great job! You have zero warnings or conduct alerts from classroom administrators.
                </p>
              </div>
            )}
          </div>

          {/* Username Requests Section (Takes 1/3 col) */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1 flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-primary" /> Username Requests
            </h2>

            {requests.length > 0 ? (
              <div className="space-y-3">
                {requests.map((r) => {
                  const isPending = r.status === "pending";
                  const isApproved = r.status === "approved";
                  const isRejected = r.status === "rejected";
                  
                  return (
                    <div 
                      key={r.id} 
                      className={`glass rounded-lg p-4 border border-border/50 space-y-2.5 ${
                        isPending 
                          ? "border-t-2 border-t-primary/60" 
                          : isApproved 
                            ? "border-t-2 border-t-success/60 bg-success/5" 
                            : "border-t-2 border-t-destructive/60 bg-destructive/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge 
                          variant={
                            isApproved 
                              ? "success" 
                              : isRejected 
                                ? "destructive" 
                                : "primary"
                          }
                          className="capitalize"
                        >
                          {r.status}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-xs space-y-1">
                        <p className="text-muted-foreground">Requested username:</p>
                        <p className="font-semibold text-foreground">"{r.requested_username}"</p>
                      </div>

                      {r.admin_note && (
                        <div className="text-[11px] p-2 rounded bg-muted/40 border border-border/50">
                          <p className="font-semibold text-muted-foreground uppercase tracking-wider text-[8px] mb-0.5">Admin Note:</p>
                          <p className="text-foreground/90 italic">"{r.admin_note}"</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass rounded-lg p-8 text-center border-dashed border border-border/60">
                <UserCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                <p className="text-sm font-semibold text-foreground">No Rename Requests</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You haven't requested a username change yet. You can submit one in Settings.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

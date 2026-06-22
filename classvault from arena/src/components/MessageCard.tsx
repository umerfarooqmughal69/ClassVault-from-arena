import React, { useState } from "react";
import { Message, dbAPI } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";
import { EyeOff, FileText, Download, AlertTriangle, MessageSquare, Reply } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

interface MessageCardProps {
  message: Message;
  onReply?: (parentMsg: Message) => void;
  showRecipient?: boolean;
  highlightAdminView?: boolean;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  message,
  onReply,
  showRecipient = false,
  highlightAdminView = false,
}) => {
  const { profile, isAdmin } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Inappropriate content");
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const isSelf = profile ? message.sender_id === profile.id : false;

  // Time formatting
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // Bytes formatting
  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return "";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Get initials for avatar
  const getInitials = () => {
    if (message.sender_username === "Anonymous") {
      return "??";
    }
    return message.sender_username ? message.sender_username.substring(0, 2).toUpperCase() : "??";
  };

  // Download attachment handler
  const handleDownloadFile = () => {
    if (!message.file_path || !message.file_name) return;
    
    // Fetch mock file URL
    const fileDataUrl = dbAPI.getMockFileUrl(message.file_path);
    if (fileDataUrl) {
      const link = document.createElement("a");
      link.href = fileDataUrl;
      link.download = message.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Downloading file...");
    } else {
      toast.error("File could not be loaded from storage.");
    }
  };

  // Submit Report
  const handleSubmitReport = async () => {
    setIsSubmittingReport(true);
    try {
      await dbAPI.createReport({
        messageId: message.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
      });
      toast.success("Message reported successfully. Classroom moderators will review this.");
      setReportOpen(false);
      setReportDetails("");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit report.");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const isMessageAnonymous = message.sender_anonymous;
  
  return (
    <div 
      className={`glass rounded-lg p-4 sm:p-5 border-l-4 transition-all duration-200 ${
        isSelf 
          ? "border-l-primary/60 bg-primary/5" 
          : isMessageAnonymous && isAdmin 
            ? "border-l-accent/60 bg-accent/5" 
            : "border-l-border"
      } ${highlightAdminView ? "hover:border-l-primary" : ""}`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div 
            className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold ${
              isSelf
                ? "bg-primary/20 text-primary border border-primary/30"
                : isMessageAnonymous
                  ? "bg-accent/15 text-accent border border-accent/20"
                  : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            {getInitials()}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className={`font-semibold text-sm ${isSelf ? "text-primary" : "text-foreground"}`}>
                {message.sender_username}
              </span>

              {/* Badges */}
              {isSelf && <Badge variant="primary">You</Badge>}
              
              {isMessageAnonymous && (
                <Badge variant="accent" className="flex items-center gap-1">
                  <EyeOff className="h-3 w-3" /> Anonymous
                </Badge>
              )}

              {/* Decrypted identity indicator for Admins & Owners */}
              {isMessageAnonymous && message.sender_username !== "Anonymous" && (
                <Badge variant="destructive" className="animate-pulse text-[10px] py-0 px-1.5 font-semibold">
                  {isAdmin && !profile?.pending_role.includes("owner") ? "Admin Decrypt" : "Owner Decrypt"}
                </Badge>
              )}

              {/* DM vs Broadcast labels */}
              {showRecipient && (
                <span className="text-xs text-muted-foreground">
                  → {message.recipient_username}
                </span>
              )}

              {message.recipient_id === null && !showRecipient && (
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                  Broadcast
                </Badge>
              )}
            </div>
            
            <span className="text-xs text-muted-foreground block">
              {formatRelativeTime(message.created_at)}
            </span>
          </div>
        </div>

        {/* Action icons */}
        {!isSelf && (
          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogTrigger>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer">
                <AlertTriangle className="h-4 w-4" />
                <span className="sr-only">Report</span>
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Report Inappropriate Content
                </DialogTitle>
                <DialogDescription>
                  Help keep your classroom vault safe. Report messages that violate code of conduct. Reports are sent directly to the classroom admin.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 my-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">Reason for Report</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Harassment", "Inappropriate content", "Spam", "Other"].map((reason) => (
                      <label 
                        key={reason} 
                        className={`flex items-center gap-2 border p-2 rounded-md cursor-pointer text-sm hover:bg-muted/50 transition-colors ${
                          reportReason === reason 
                            ? "border-primary bg-primary/5 text-primary" 
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="reportReason" 
                          value={reason} 
                          checked={reportReason === reason}
                          onChange={(e) => setReportReason(e.target.value)}
                          className="text-primary focus:ring-primary h-4 w-4 bg-transparent border-border" 
                        />
                        {reason}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground block">Details (optional)</label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide additional details to help the admin understand the issue..."
                    className="w-full text-sm rounded-md border border-border bg-input px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setReportOpen(false)} disabled={isSubmittingReport}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleSubmitReport} disabled={isSubmittingReport}>
                  {isSubmittingReport ? "Submitting..." : "Submit Report"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Card Body */}
      <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed pl-1">
        {message.content}
      </div>

      {/* File Attachment Pill */}
      {message.file_path && message.file_name && (
        <div className="mt-3.5 flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/40 max-w-full sm:max-w-md">
          <div className="flex items-center gap-2 overflow-hidden min-w-0">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{message.file_name}</p>
              <p className="text-[10px] text-muted-foreground">{formatBytes(message.file_size)}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-primary hover:text-primary-foreground hover:bg-primary shrink-0 gap-1 cursor-pointer"
            onClick={handleDownloadFile}
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Download</span>
          </Button>
        </div>
      )}

      {/* Reply Action */}
      {onReply && !message.parent_id && (
        <div className="mt-4 pt-3 border-t border-border/40 flex justify-start">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-muted-foreground hover:text-primary gap-1.5 cursor-pointer text-xs"
            onClick={() => onReply(message)}
          >
            <Reply className="h-3.5 w-3.5" />
            Reply to Thread
          </Button>
        </div>
      )}

      {/* Collapsible Thread Replies */}
      {message.replies && message.replies.length > 0 && (
        <div className="mt-4 pl-4 sm:pl-6 border-l border-border/80 space-y-4 bg-muted/10 p-3 rounded-r-md">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Replies ({message.replies.length})
          </div>
          {message.replies.map((reply) => (
            <div key={reply.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-xs ${reply.sender_id === profile?.id ? "text-primary" : "text-foreground"}`}>
                  {reply.sender_username}
                </span>
                
                {reply.sender_id === profile?.id && <Badge variant="primary" className="text-[9px] py-0 px-1">You</Badge>}
                
                {reply.sender_anonymous && (
                  <Badge variant="accent" className="text-[9px] py-0 px-1 flex items-center gap-0.5">
                    <EyeOff className="h-2 w-2" /> Anon
                  </Badge>
                )}

                {reply.sender_anonymous && reply.sender_username !== "Anonymous" && (
                  <Badge variant="destructive" className="text-[9px] py-0 px-1">
                    {isAdmin && !profile?.pending_role.includes("owner") ? "Admin Decrypt" : "Owner Decrypt"}
                  </Badge>
                )}

                <span className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(reply.created_at)}
                </span>
              </div>
              
              <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">
                {reply.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

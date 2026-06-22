import React, { useState, useRef, useEffect } from "react";
import { Paperclip, Send, X, File, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { dbAPI } from "@/lib/db";
import { useAuth } from "@/hooks/useAuth";

interface MessageComposerProps {
  mode: "broadcast" | "direct";
  recipientId?: string | null;
  parentId?: string | null; // For replies
  placeholder?: string;
  onSuccess?: () => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  mode,
  recipientId = null,
  parentId = null,
  placeholder = "Type your message here...",
  onSuccess,
}) => {
  const { isAdmin } = useAuth();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // File Attachment State
  const [filePreview, setFilePreview] = useState<{ name: string; size: number; dataUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // App Settings Toggles
  const [fileUploadsEnabled, setFileUploadsEnabled] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(true);

  // Load feature settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const fileEnabled = await dbAPI.getSettingValue("file_uploads_enabled");
        setFileUploadsEnabled(fileEnabled);

        if (mode === "broadcast") {
          const bEnabled = await dbAPI.getSettingValue("broadcast_enabled");
          setFeatureEnabled(bEnabled);
        } else {
          const dEnabled = await dbAPI.getSettingValue("direct_messages_enabled");
          setFeatureEnabled(dEnabled);
        }
      } catch (e) {
        console.error("Failed to load app settings in composer", e);
      }
    };

    loadSettings();
    
    // Set up interval to poll settings changes
    const interval = setInterval(loadSettings, 5000);
    return () => clearInterval(interval);
  }, [mode]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate size limit (400 MB)
    const MAX_SIZE = 400 * 1024 * 1024; // 400 MB in bytes
    if (selectedFile.size > MAX_SIZE) {
      toast.error("File is too large! Maximum allowed size is 400 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Convert file to Base64 Data URL for local database simulation
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview({
        name: selectedFile.name,
        size: selectedFile.size,
        dataUrl: reader.result as string
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  // Remove attached file
  const removeFile = () => {
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() && !filePreview) {
      toast.error("Please enter a message or attach a file.");
      return;
    }

    setIsSubmitting(true);
    try {
      await dbAPI.sendMessage({
        content: content.trim(),
        recipientId,
        parentId,
        file: filePreview
      });

      // Clear input
      setContent("");
      removeFile();
      toast.success("Message sent successfully!");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If the feature is disabled and user is not admin, show locked state
  if (!featureEnabled && !isAdmin) {
    return (
      <div className="glass rounded-lg p-4 flex flex-col items-center justify-center text-center text-muted-foreground border-dashed border border-border/60">
        <Lock className="h-5 w-5 mb-2 text-accent" />
        <p className="text-sm font-medium">
          {mode === "broadcast" 
            ? "Class broadcast messages are currently disabled by the administrator." 
            : "Direct messaging is currently disabled by the administrator."}
        </p>
      </div>
    );
  }

  const isUploadDisabled = !fileUploadsEnabled && !isAdmin;

  return (
    <form onSubmit={handleSubmit} className="glass rounded-lg p-4 space-y-3 border border-border/60">
      <div className="relative">
        <textarea
          rows={parentId ? 2 : 3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm bg-transparent resize-none border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 p-0"
          style={{ minHeight: parentId ? "50px" : "80px" }}
          disabled={isSubmitting}
        />
      </div>

      {/* File preview pill */}
      {filePreview && (
        <div className="flex items-center justify-between p-2 rounded bg-muted/60 text-xs border border-border max-w-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <File className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate font-medium">{filePreview.name}</span>
          </div>
          <button
            type="button"
            onClick={removeFile}
            className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Footer controls */}
      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <div className="flex items-center">
          <input
            type="file"
            id={`composer-file-${parentId || 'main'}`}
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={isSubmitting || isUploadDisabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer ${
              isUploadDisabled ? "opacity-40 cursor-not-allowed hover:text-muted-foreground" : ""
            }`}
            onClick={() => document.getElementById(`composer-file-${parentId || 'main'}`)?.click()}
            disabled={isSubmitting || isUploadDisabled}
            title={isUploadDisabled ? "File uploads are disabled by admin" : "Attach a file (Max 400MB)"}
          >
            <Paperclip className="h-4.5 w-4.5" />
          </Button>
          
          {isUploadDisabled && (
            <span className="text-[10px] text-muted-foreground ml-1 hidden sm:inline">
              (File uploads disabled)
            </span>
          )}
        </div>

        <Button
          type="submit"
          size="sm"
          className="gap-1.5 cursor-pointer text-xs h-8"
          disabled={isSubmitting || (!content.trim() && !filePreview)}
        >
          <Send className="h-3.5 w-3.5" />
          {isSubmitting ? "Sending..." : parentId ? "Reply" : "Send"}
        </Button>
      </div>
    </form>
  );
};

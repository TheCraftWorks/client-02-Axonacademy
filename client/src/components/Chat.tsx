import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import {
  Send,
  Search,
  MessageSquare,
  X,
  ArrowLeft,
  Info,
  CheckCheck,
} from "lucide-react";
import { useChatSocket } from "@/hooks/useChatSocket";
import { getChatUsers, getConversation, sendMessage as apiSendMessage } from "@/lib/api";
import { useClassroomStore } from "@/lib/classroomStore";
import type { ChatUser, ChatMessage } from "@/lib/api";

interface ChatProps {
  currentUserRole: "student" | "faculty" | "admin" | "accounts" | "receptionist" | "superadmin";
}

type RoleTab = "all" | "student" | "faculty" | "admin";

// ─── Memoized User List Item (WhatsApp Contact Row) ───────────────────────────
const UserListItem = memo(function UserListItem({
  user,
  isActive,
  unreadCount,
  onSelect,
}: {
  user: ChatUser;
  isActive: boolean;
  unreadCount: number;
  onSelect: (id: string) => void;
}) {
  const initials = useMemo(() => {
    if (!user.fullName) return "U";
    return user.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }, [user.fullName]);

  const formattedTime = useMemo(() => {
    if (!user.lastMessageTime) return null;
    try {
      const date = new Date(user.lastMessageTime);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString("en-IN", {
          hour: "numeric",
          minute: "2-digit",
        });
      }
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return null;
    }
  }, [user.lastMessageTime]);

  const roleStyle = useMemo(() => {
    switch (user.role) {
      case "student":
        return {
          label: "Student",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
          avatarBg: "bg-emerald-700 text-white",
        };
      case "faculty":
        return {
          label: "Faculty",
          badge: "bg-sky-50 text-sky-700 border-sky-200/70",
          avatarBg: "bg-sky-700 text-white",
        };
      case "admin":
      case "superadmin":
        return {
          label: "Admin",
          badge: "bg-purple-50 text-purple-700 border-purple-200/70",
          avatarBg: "bg-plum-dark text-lime",
        };
      default:
        return {
          label: user.role,
          badge: "bg-slate-100 text-slate-600 border-slate-200/70",
          avatarBg: "bg-slate-700 text-white",
        };
    }
  }, [user.role]);

  return (
    <button
      type="button"
      onClick={() => onSelect(user._id)}
      style={{ contentVisibility: "auto", containIntrinsicSize: "72px" }}
      className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition-all duration-150 rounded-2xl mx-auto my-0.5 border ${
        isActive
          ? "bg-plum-dark/10 border-plum-dark/25 shadow-xs"
          : "hover:bg-slate-100/90 border-transparent"
      }`}
    >
      <div className="relative shrink-0">
        <div
          className={`grid h-11 w-11 place-items-center rounded-full text-xs font-bold shadow-xs select-none ${roleStyle.avatarBg}`}
        >
          {initials}
        </div>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 grid h-5 min-w-5 px-1 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white border-2 border-white shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-1.5 mb-0.5">
          <span
            className={`text-sm font-semibold truncate ${
              isActive ? "text-plum-dark font-bold" : "text-slate-800"
            }`}
          >
            {user.fullName}
          </span>
          {formattedTime && (
            <span className="text-[10px] font-medium text-slate-400 shrink-0 font-mono">
              {formattedTime}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500 truncate flex-1 leading-snug">
            {user.lastMessage ? (
              user.lastMessage
            ) : (
              <span className="italic text-slate-400">No messages yet</span>
            )}
          </p>
          <span
            className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border shrink-0 uppercase tracking-wider ${roleStyle.badge}`}
          >
            {roleStyle.label}
          </span>
        </div>
      </div>
    </button>
  );
});

// ─── Skeleton Loading Component ───────────────────────────────────────────────
function UserListSkeleton() {
  return (
    <div className="p-2 space-y-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-2xl bg-white/60 animate-pulse border border-slate-100"
        >
          <div className="h-11 w-11 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-center">
              <div className="h-3.5 bg-slate-200 rounded w-1/3" />
              <div className="h-2.5 bg-slate-200 rounded w-12" />
            </div>
            <div className="flex justify-between items-center">
              <div className="h-3 bg-slate-100 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Memoized Message Input (WhatsApp Style) ──────────────────────────────────
const MessageInput = memo(function MessageInput({
  onSendMessage,
  disabled,
}: {
  onSendMessage: (text: string) => Promise<void>;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    setText("");
    try {
      await onSendMessage(trimmed);
      inputRef.current?.focus();
    } catch (err) {
      console.error("Failed to send message:", err);
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 sm:p-4 border-t border-border bg-white flex items-center gap-2 sm:gap-3 shrink-0"
    >
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        disabled={disabled}
        className="flex-1 rounded-full bg-slate-100/90 border border-slate-200 px-5 py-3 text-sm outline-none focus:bg-white focus:border-plum/40 focus:ring-2 focus:ring-plum/20 transition-all text-slate-800 placeholder:text-slate-400"
      />
      <button
        disabled={!text.trim() || sending || disabled}
        type="submit"
        className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-full bg-plum-dark text-lime hover:bg-plum active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm"
        title="Send Message"
      >
        <Send className="h-4 w-4 sm:h-5 sm:w-5 ml-0.5" />
      </button>
    </form>
  );
});

// ─── Main Chat Component ──────────────────────────────────────────────────────
export default function Chat({ currentUserRole }: ChatProps) {
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState<RoleTab>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showProfileModal, setShowProfileModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useClassroomStore();
  const currentUserId = currentUser?.id || "";

  const isStudent = currentUserRole === "student";
  const isFaculty = currentUserRole === "faculty";
  const isAdmin =
    currentUserRole === "admin" ||
    currentUserRole === "superadmin" ||
    currentUserRole === "accounts" ||
    currentUserRole === "receptionist";

  // Initial fetch of chat users
  useEffect(() => {
    if (!isStudent && !isFaculty && !isAdmin) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const users = await getChatUsers();
        if (isMounted) {
          setChatUsers(users);
        }
      } catch (err) {
        console.error("Failed to fetch chat users:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, [isStudent, isFaculty, isAdmin]);

  // Load conversation when active user changes
  useEffect(() => {
    if (!activeUserId) {
      setMessages([]);
      return;
    }

    // Clear unread count for this conversation
    setUnreadCounts((prev) => {
      if (!prev[activeUserId]) return prev;
      const next = { ...prev };
      delete next[activeUserId];
      return next;
    });

    let isMounted = true;
    setLoadingMessages(true);

    const fetchMessages = async () => {
      try {
        const msgs = await getConversation(activeUserId);
        if (isMounted) {
          setMessages(msgs);
        }
      } catch (err) {
        console.error("Failed to fetch conversation:", err);
      } finally {
        if (isMounted) {
          setLoadingMessages(false);
        }
      }
    };

    fetchMessages();
    return () => {
      isMounted = false;
    };
  }, [activeUserId]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle incoming private message via socket
  const handleMessageReceived = useCallback(
    (msg: any) => {
      const isToMe = msg.receiverId._id === currentUserId;
      const isFromMe = msg.senderId._id === currentUserId;
      if (!isToMe && !isFromMe) return;

      const otherId = isToMe ? msg.senderId._id : msg.receiverId._id;

      // If this conversation is currently open, append message
      if (activeUserId === otherId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      } else if (isToMe) {
        // Increment unread badge for sender
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.senderId._id]: (prev[msg.senderId._id] || 0) + 1,
        }));
      }

      // Update chatUsers list in memory seamlessly without refetching from server
      setChatUsers((prevUsers) => {
        const partnerIndex = prevUsers.findIndex((u) => u._id === otherId);
        if (partnerIndex === -1) {
          // If partner is not yet in the list, background refresh
          getChatUsers().then(setChatUsers).catch(console.error);
          return prevUsers;
        }

        const updatedUser: ChatUser = {
          ...prevUsers[partnerIndex],
          lastMessage: msg.message,
          lastMessageTime: msg.createdAt || new Date().toISOString(),
        };

        const otherUsers = prevUsers.filter((_, idx) => idx !== partnerIndex);
        return [updatedUser, ...otherUsers];
      });
    },
    [activeUserId, currentUserId]
  );

  const { sendMessage: socketSend } = useChatSocket(handleMessageReceived, currentUserId);

  // Send message handler
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeUserId) return;

      const now = new Date().toISOString();

      // Send via Socket.IO for real-time delivery
      const sent = socketSend(activeUserId, content);
      if (!sent) {
        // Fallback to REST API if socket is not ready
        const msg = await apiSendMessage(activeUserId, content);
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }

      // Optimistically update last message in chatUsers list
      setChatUsers((prevUsers) => {
        const partnerIndex = prevUsers.findIndex((u) => u._id === activeUserId);
        if (partnerIndex === -1) return prevUsers;

        const updatedUser: ChatUser = {
          ...prevUsers[partnerIndex],
          lastMessage: content,
          lastMessageTime: now,
        };

        const otherUsers = prevUsers.filter((_, idx) => idx !== partnerIndex);
        return [updatedUser, ...otherUsers];
      });
    },
    [activeUserId, socketSend]
  );

  const activeUser = useMemo(
    () => chatUsers.find((u) => u._id === activeUserId),
    [chatUsers, activeUserId]
  );

  // Active user style
  const activeRoleStyle = useMemo(() => {
    if (!activeUser) return { label: "", badge: "", avatarBg: "bg-plum-dark text-lime" };
    switch (activeUser.role) {
      case "student":
        return {
          label: "Student",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
          avatarBg: "bg-emerald-700 text-white",
        };
      case "faculty":
        return {
          label: "Faculty",
          badge: "bg-sky-50 text-sky-700 border-sky-200/70",
          avatarBg: "bg-sky-700 text-white",
        };
      case "admin":
      case "superadmin":
        return {
          label: "Admin",
          badge: "bg-purple-50 text-purple-700 border-purple-200/70",
          avatarBg: "bg-plum-dark text-lime",
        };
      default:
        return {
          label: activeUser.role,
          badge: "bg-slate-100 text-slate-600 border-slate-200/70",
          avatarBg: "bg-slate-700 text-white",
        };
    }
  }, [activeUser]);

  // Filtered users with tab and search query
  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return chatUsers.filter((u) => {
      // Role Tab Filter
      if (selectedTab !== "all") {
        if (selectedTab === "admin") {
          if (u.role !== "admin" && u.role !== "superadmin") return false;
        } else if (u.role !== selectedTab) {
          return false;
        }
      }

      // Search Query Filter
      if (!query) return true;
      return (
        (u.fullName && u.fullName.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.role && u.role.toLowerCase().includes(query))
      );
    });
  }, [chatUsers, search, selectedTab]);

  // Role counts for tab badges
  const roleCounts = useMemo(() => {
    let studentCount = 0;
    let facultyCount = 0;
    let adminCount = 0;
    for (const u of chatUsers) {
      if (u.role === "student") studentCount++;
      else if (u.role === "faculty") facultyCount++;
      else if (u.role === "admin" || u.role === "superadmin") adminCount++;
    }
    return {
      all: chatUsers.length,
      student: studentCount,
      faculty: facultyCount,
      admin: adminCount,
    };
  }, [chatUsers]);

  const getInitials = useCallback((name: string) => {
    if (!name) return "U";
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }, []);

  if (!isStudent && !isFaculty && !isAdmin) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-180px)] bg-slate-50 rounded-3xl border border-border">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            Messaging is available for students, faculty, and administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white border border-border overflow-hidden h-[calc(100vh-80px)] flex shadow-sm relative">
      {/* ─── Sidebar - WhatsApp Contact List ────────────────────────────────── */}
      <aside
        className={`border-r border-border flex flex-col bg-slate-50/50 transition-all duration-200 ${
          activeUserId
            ? "hidden md:flex md:w-[340px] lg:w-[380px] shrink-0"
            : "w-full md:w-[340px] lg:w-[380px] shrink-0 flex"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-plum-dark text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-plum" />
              {isStudent ? "Faculty & Admin" : "Chats"}
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {chatUsers.length} contacts
            </span>
          </div>

          {/* Search Input */}
          <div className="relative flex items-center bg-slate-100/90 rounded-full px-3.5 py-2 border border-slate-200/80 focus-within:border-plum/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-plum/15 transition-all">
            <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats or contacts..."
              className="bg-transparent text-xs sm:text-sm outline-none flex-1 text-slate-700 placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter Tabs (for Admin & Faculty) */}
          {!isStudent && (
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSelectedTab("all")}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center ${
                  selectedTab === "all"
                    ? "bg-white text-plum-dark shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                All ({roleCounts.all})
              </button>

              <button
                type="button"
                onClick={() => setSelectedTab("student")}
                className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center ${
                  selectedTab === "student"
                    ? "bg-white text-emerald-700 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Students ({roleCounts.student})
              </button>

              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setSelectedTab("faculty")}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center ${
                    selectedTab === "faculty"
                      ? "bg-white text-sky-700 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Faculty ({roleCounts.faculty})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedTab("admin")}
                  className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center ${
                    selectedTab === "admin"
                      ? "bg-white text-purple-700 shadow-xs font-bold"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Admin ({roleCounts.admin})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable User List Container */}
        <div className="flex-1 overflow-y-auto px-2 py-2 divide-y-0 scroll-smooth overscroll-contain">
          {loading ? (
            <UserListSkeleton />
          ) : filteredUsers.length === 0 ? (
            <div className="text-center p-8 text-sm text-slate-500 space-y-2">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 mx-auto text-slate-400">
                <Search className="h-5 w-5" />
              </div>
              <p className="font-medium text-slate-600">
                {search ? "No matches found" : "No contacts available"}
              </p>
              <p className="text-xs text-slate-400">
                {search
                  ? "Try searching with a different term or clear filter."
                  : "Active contacts will appear here."}
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <UserListItem
                key={user._id}
                user={user}
                isActive={activeUserId === user._id}
                unreadCount={unreadCounts[user._id] || 0}
                onSelect={setActiveUserId}
              />
            ))
          )}
        </div>
      </aside>

      {/* ─── WhatsApp-Style Conversation Screen ─────────────────────────────── */}
      <section
        className={`flex-col flex-1 h-full min-w-0 bg-white ${
          activeUserId ? "flex w-full" : "hidden md:flex"
        }`}
      >
        {activeUser ? (
          <>
            {/* WhatsApp Chat Header */}
            <header className="p-3 sm:p-4 border-b border-border flex items-center justify-between bg-white z-10 shadow-xs">
              <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                {/* Back button (returns to contact list like WhatsApp) */}
                <button
                  type="button"
                  onClick={() => setActiveUserId(null)}
                  className="p-2 -ml-1 text-slate-600 hover:text-plum-dark hover:bg-slate-100 rounded-full transition-colors md:hidden"
                  title="Back to contacts"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>

                {/* Profile Avatar & Name (clickable to view Profile Info) */}
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="flex items-center gap-2.5 sm:gap-3 text-left hover:opacity-85 transition-opacity min-w-0"
                >
                  <div className="relative shrink-0">
                    <div
                      className={`grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-full text-xs font-bold shadow-xs select-none ${activeRoleStyle.avatarBg}`}
                    >
                      {getInitials(activeUser.fullName)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-plum-dark text-sm sm:text-base truncate flex items-center gap-1.5">
                      {activeUser.fullName}
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5 truncate">
                      <span className="capitalize text-slate-500 font-medium">{activeUser.role}</span>
                      {activeUser.email && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-400 truncate max-w-[160px] sm:max-w-[240px]">
                            {activeUser.email}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="p-2 text-slate-500 hover:text-plum-dark hover:bg-slate-100 rounded-full transition-colors"
                  title="View contact info"
                >
                  <Info className="h-5 w-5" />
                </button>
              </div>
            </header>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#f0f2f5] overscroll-contain">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-plum animate-ping" />
                    Loading conversation...
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400 space-y-2">
                  <div className="grid h-14 w-14 place-items-center rounded-3xl bg-white shadow-xs border border-slate-100 text-plum">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600">
                    Start a conversation with {activeUser.fullName}
                  </p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Send a message below to begin your chat.
                  </p>
                </div>
              ) : (
                messages.map((m, i, arr) => {
                  const isMe = m.senderId._id === currentUserId;
                  const showTime =
                    i === 0 ||
                    new Date(m.createdAt).getTime() - new Date(arr[i - 1].createdAt).getTime() >
                      1000 * 60 * 30;

                  return (
                    <div key={m._id} className="space-y-1">
                      {showTime && (
                        <div className="text-center my-4">
                          <span className="inline-block px-3 py-1 rounded-full bg-white/80 backdrop-blur-xs text-[10px] font-semibold text-slate-600 uppercase tracking-wider font-mono shadow-xs border border-slate-200/50">
                            {new Date(m.createdAt).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-sm shadow-xs leading-relaxed break-words ${
                            isMe
                              ? "bg-[#2D1B47] text-white rounded-br-xs font-medium border border-[#2D1B47]"
                              : "bg-white border border-slate-200 text-slate-900 rounded-bl-xs"
                          }`}
                          style={{
                            backgroundColor: isMe ? "#2D1B47" : "#ffffff",
                            color: isMe ? "#ffffff" : "#0f172a",
                          }}
                        >
                          <p
                            className="whitespace-pre-wrap text-sm leading-relaxed"
                            style={{ color: isMe ? "#ffffff" : "#0f172a" }}
                          >
                            {m.message}
                          </p>
                          <div
                            className="text-[10px] mt-1 flex items-center justify-end gap-1 font-mono"
                            style={{ color: isMe ? "#e9d5ff" : "#64748b" }}
                          >
                            <span style={{ color: isMe ? "#e9d5ff" : "#64748b" }}>
                              {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            {isMe && (
                              <CheckCheck
                                className="h-3.5 w-3.5 inline"
                                style={{ color: "#C5F542" }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Component */}
            <MessageInput onSendMessage={handleSendMessage} disabled={loadingMessages} />
          </>
        ) : (
          <div className="flex-1 grid place-items-center bg-slate-50/50 p-6">
            <div className="text-center max-w-sm space-y-3">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white border border-border shadow-xs text-plum mx-auto">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="font-display font-bold text-plum-dark text-lg">
                Axon Messages
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Select a contact from the list on the left to view messages and start chatting.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ─── WhatsApp-Style Contact Profile Modal ────────────────────────────── */}
      {showProfileModal && activeUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-display font-bold text-plum-dark text-lg">Contact Info</h3>
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="text-center space-y-3">
              <div
                className={`grid h-20 w-20 place-items-center rounded-full text-xl font-bold mx-auto shadow-md ${activeRoleStyle.avatarBg}`}
              >
                {getInitials(activeUser.fullName)}
              </div>
              <div>
                <h4 className="font-display font-bold text-slate-800 text-lg">
                  {activeUser.fullName}
                </h4>
                <span
                  className={`inline-block text-xs font-semibold px-3 py-0.5 rounded-full border mt-1 uppercase tracking-wider ${activeRoleStyle.badge}`}
                >
                  {activeRoleStyle.label}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-sm border border-slate-100">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Email Address
                </span>
                <span className="text-slate-800 font-medium">{activeUser.email || "Not specified"}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Role
                </span>
                <span className="text-slate-800 font-medium capitalize">{activeUser.role}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                  User ID
                </span>
                <span className="text-slate-600 font-mono text-xs">{activeUser._id}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="w-full py-3 bg-plum-dark hover:bg-plum text-cream rounded-2xl font-semibold transition-colors shadow-xs"
            >
              Back to Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
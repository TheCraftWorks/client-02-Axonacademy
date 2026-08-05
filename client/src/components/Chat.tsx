import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Send, Search, MessageSquare } from "lucide-react";
import { useChatSocket } from "@/hooks/useChatSocket";
import { getChatUsers, getConversation, sendMessage as apiSendMessage } from "@/lib/api";
import { useClassroomStore } from "@/lib/classroomStore";
import type { ChatUser, ChatMessage } from "@/lib/api";

interface ChatProps {
  currentUserRole: "student" | "faculty" | "admin" | "accounts" | "receptionist" | "superadmin";
}

export default function Chat({ currentUserRole }: ChatProps) {
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useClassroomStore();

  const currentUserId = currentUser?.id || "";

  const isStudent = currentUserRole === "student";
  const isFaculty = currentUserRole === "faculty";
  const isAdmin = currentUserRole === "admin";

  // Load chat users list
  useEffect(() => {
    if (!isStudent && !isFaculty && !isAdmin) {
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      try {
        const users = await getChatUsers();
        setChatUsers(users);
      } catch (err) {
        console.error("Failed to fetch chat users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isStudent, isFaculty, isAdmin]);

  // Load conversation when active user changes
  useEffect(() => {
    if (!activeUserId) {
      setMessages([]);
      return;
    }

    // Clear unread count for the opened conversation
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[activeUserId];
      return next;
    });

    const fetchMessages = async () => {
      try {
        const msgs = await getConversation(activeUserId);
        setMessages(msgs);
      } catch (err) {
        console.error("Failed to fetch conversation:", err);
      }
    };

    fetchMessages();
  }, [activeUserId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleMessageReceived = useCallback((msg: any) => {
    const isToMe = msg.receiverId._id === currentUserId;
    const isFromMe = msg.senderId._id === currentUserId;
    if (!isToMe && !isFromMe) return;

    // If this conversation is currently open, add the message
    const otherId = activeUserId;
    const isFromOther = msg.senderId._id === otherId;
    const isToOther = msg.receiverId._id === otherId;

    if (isFromOther || isToOther) {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    } else if (isToMe && !otherId) {
      // Auto-select conversation if none selected and message is for me
      setActiveUserId(msg.senderId._id);
    }

    // Track unread messages when conversation is not open
    if (isToMe && otherId !== msg.senderId._id) {
      const senderId = msg.senderId._id;
      setUnreadCounts((prev) => ({ ...prev, [senderId]: (prev[senderId] || 0) + 1 }));
    }

    // Refresh users list to update last message
    getChatUsers().then(setChatUsers).catch(console.error);
  }, [activeUserId, currentUserId]);

  const { sendMessage: socketSend } = useChatSocket(handleMessageReceived, currentUserId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeUserId || sending) return;

    const content = text.trim();
    setText("");
    setSending(true);

    try {
      // Send via Socket.IO for real-time delivery
      const sent = socketSend(activeUserId, content);
      if (!sent) {
        // Fallback to REST API if socket not ready
        const msg = await apiSendMessage(activeUserId, content);
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const activeUser = chatUsers.find((u) => u._id === activeUserId);
  const filteredUsers = chatUsers.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const sortedMessages = useMemo(() => {
    return [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  if (!isStudent && !isFaculty && !isAdmin) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-180px)] bg-slate-50 rounded-3xl border border-border">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Messaging is available for students, faculty, and admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white border border-border overflow-hidden h-[calc(100vh-80px)] flex flex-col md:flex-row">
      {/* Sidebar - User List */}
      <aside className="border-r border-border flex flex-col w-full md:w-[320px] shrink-0 bg-slate-50/50">
        <div className="p-4 border-b border-border bg-white">
          <h2 className="font-display font-bold text-plum-dark text-lg">
            {isStudent ? "Faculty & Admin" : isFaculty ? "All Users" : "All Users"}
          </h2>
          <div className="mt-3 flex items-center gap-2 bg-slate-100 rounded-full px-4 py-2.5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-sm outline-none flex-1 text-slate-700"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-slate-400">Loading...</div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center p-6 text-sm text-slate-500">
              {search ? "No users found." : "No users available for chat."}
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isActive = activeUserId === user._id;
              return (
                <button
                  key={user._id}
                  onClick={() => setActiveUserId(user._id)}
                  className={`w-full text-left px-4 py-4 flex items-start gap-3 border-b border-border/60 transition-colors ${
                    isActive ? "bg-plum-dark/5" : "hover:bg-slate-100"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-plum-dark text-lime text-xs font-bold">
                      {getInitials(user.fullName)}
                    </div>
                    {unreadCounts[user._id] > 0 && (
                      <div className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white shadow-sm">
                        {unreadCounts[user._id]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex justify-between items-baseline gap-2">
                      <div className="text-sm font-semibold text-plum-dark truncate">
                        {user.fullName}
                     <div className="text-[10px] text-slate-400 truncate">
                     ({user.role})</div>
                      </div>
                      {user.lastMessageTime && (
                        <div className="text-[10px] font-mono text-slate-400 shrink-0">
                          {new Date(user.lastMessageTime).toLocaleTimeString("en-IN", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                   
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <section className="flex flex-col flex-1 h-full min-w-0 bg-white">
        {activeUser ? (
          <>
            {/* Chat Header */}
            <header className="p-4 border-b border-border flex items-center gap-3 bg-white z-10 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-plum-dark text-lime text-xs font-bold">
                {getInitials(activeUser.fullName)}
              </div>
              <div>
                <div className="font-semibold text-plum-dark">{activeUser.fullName}</div>
                <div className="text-xs text-slate-500 capitalize">{activeUser.role}</div>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#f8f9fa]">
              {sortedMessages.length === 0 && (
                <div className="text-center text-sm text-slate-400 font-medium py-10">
                  Start the conversation...
                </div>
              )}
              {sortedMessages.map((m, i, arr) => {
                const isMe = m.senderId._id === currentUserId;
                const showTime =
                  i === 0 ||
                  new Date(m.createdAt).getTime() - new Date(arr[i - 1].createdAt).getTime() >
                    1000 * 60 * 30;
                return (
                  <div key={m._id}>
                    {showTime && (
                      <div className="text-center text-[10px] text-slate-400 mb-4 mt-2 font-mono uppercase tracking-widest">
                        {new Date(m.createdAt).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-5 py-3 text-sm shadow-sm leading-relaxed ${
                          isMe
                            ? "bg-plum-dark text-cream rounded-br-sm"
                            : "bg-cream/80 border border-slate-200 text-slate-700 rounded-bl-sm"
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-border bg-white flex items-center gap-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-full bg-slate-100 border border-slate-200 px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-plum/30 transition-all text-slate-700"
              />
              <button
                disabled={!text.trim() || sending}
                type="submit"
                className="grid h-12 w-12 place-items-center rounded-full bg-plum-dark text-lime hover:bg-plum transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
              >
                <Send className="h-5 w-5 ml-1" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 grid place-items-center bg-slate-50 text-slate-400 text-sm">
            Select a conversation to start messaging
          </div>
        )}
      </section>
    </div>
  );
}
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, MessageCircle, Plus, Send, X } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { playMessageSound } from "../sounds";

const API_URL = import.meta.env.VITE_API_URL || "";

type Person = { id: string; name: string; role: string; avatar?: string | null };
type Contact = Person & { department?: string | null };
type Thread = {
  id: string;
  other: Person;
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
};
type ChatMessage = { id: string; body: string; createdAt: string; mine: boolean };

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Employee",
  HR_ADMIN: "HR",
  CORPORATE_ADMIN: "Company admin",
  TRAINER: "Specialist",
  SUPER_ADMIN: "Dharma Admin"
};

function roleLabel(role: string) {
  return ROLE_LABEL[role] || role;
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("hsos_token") || "";
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data as T;
}

export function MessengerWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"threads" | "contacts" | "chat">("threads");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<{ id: string; other: Person } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadUnread = useCallback(async () => {
    try {
      const { count } = await api<{ count: number }>("/api/messages/unread-count");
      setUnread(count);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  const loadThreads = useCallback(async () => {
    try {
      const { threads: list } = await api<{ threads: Thread[] }>("/api/messages/threads");
      setThreads(list);
    } catch {
      /* ignore */
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const data = await api<{ thread: { id: string; other: Person }; messages: ChatMessage[] }>(
        `/api/messages/threads/${conversationId}/messages`
      );
      setMessages(data.messages);
      setActive(data.thread);
    } catch {
      /* ignore */
    }
  }, []);

  // Background unread polling whether or not the panel is open.
  useEffect(() => {
    void loadUnread();
    const id = window.setInterval(loadUnread, 12000);
    return () => window.clearInterval(id);
  }, [loadUnread]);

  // Standard chime whenever the unread count rises (after the first load).
  const prevUnreadRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevUnreadRef.current !== null && unread > prevUnreadRef.current) {
      playMessageSound();
    }
    prevUnreadRef.current = unread;
  }, [unread]);

  // Refresh thread list while the list is visible.
  useEffect(() => {
    if (!open || view !== "threads") return;
    void loadThreads();
    const id = window.setInterval(loadThreads, 8000);
    return () => window.clearInterval(id);
  }, [open, view, loadThreads]);

  // Poll the active conversation.
  useEffect(() => {
    if (!open || view !== "chat" || !active) return;
    const id = window.setInterval(() => {
      void loadMessages(active.id);
      void loadUnread();
    }, 5000);
    return () => window.clearInterval(id);
  }, [open, view, active, loadMessages, loadUnread]);

  useEffect(() => {
    if (view === "chat" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, view]);

  const openThreads = () => {
    setView("threads");
    setActive(null);
    void loadThreads();
    void loadUnread();
  };

  const openContacts = async () => {
    setView("contacts");
    try {
      const { contacts: list } = await api<{ contacts: Contact[] }>("/api/messages/contacts");
      setContacts(list);
    } catch {
      setContacts([]);
    }
  };

  const openChat = async (conversationId: string, other: Person) => {
    setActive({ id: conversationId, other });
    setMessages([]);
    setView("chat");
    await loadMessages(conversationId);
    void loadUnread();
    void loadThreads();
  };

  const startWith = async (contact: Contact) => {
    try {
      const { thread } = await api<{ thread: Thread }>("/api/messages/threads", {
        method: "POST",
        body: JSON.stringify({ userId: contact.id })
      });
      await openChat(thread.id, thread.other);
    } catch {
      /* ignore */
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !active || sending) return;
    setSending(true);
    setDraft("");
    // Optimistic append.
    const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, body, createdAt: new Date().toISOString(), mine: true };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const { message } = await api<{ message: ChatMessage }>(`/api/messages/threads/${active.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body })
      });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? message : m)));
      void loadThreads();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end">
      {open && (
        <div className="mb-3 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-[var(--cwp-border)] bg-[var(--cwp-surface)] shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-[var(--cwp-border)] bg-[var(--cwp-army-muted)] px-3 py-3">
            {view === "chat" || view === "contacts" ? (
              <button
                type="button"
                onClick={openThreads}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--cwp-olive)] hover:bg-white/50"
                aria-label="Back"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <MessageCircle size={18} className="ml-1 text-[var(--cwp-olive)]" />
            )}
            <div className="min-w-0 flex-1">
              {view === "chat" && active ? (
                <>
                  <p className="truncate text-sm font-semibold text-[var(--cwp-charcoal)]">{active.other.name}</p>
                  <p className="truncate text-[11px] text-[var(--cwp-text-muted)]">{roleLabel(active.other.role)}</p>
                </>
              ) : (
                <p className="text-sm font-semibold text-[var(--cwp-charcoal)]">
                  {view === "contacts" ? "New message" : "Messages"}
                </p>
              )}
            </div>
            {view === "threads" && (
              <button
                type="button"
                onClick={openContacts}
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--cwp-olive)] hover:bg-white/50"
                aria-label="New message"
              >
                <Plus size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-full text-[var(--cwp-text-muted)] hover:bg-white/50"
              aria-label="Close messages"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto" ref={view === "chat" ? scrollRef : undefined}>
            {view === "threads" && (
              <ul className="divide-y divide-[var(--cwp-border)]">
                {threads.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-[var(--cwp-text-muted)]">
                    No conversations yet. Tap <span className="font-medium">+</span> to start one.
                  </li>
                )}
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openChat(t.id, t.other)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-[var(--cwp-bg)]"
                    >
                      <UserAvatar name={t.other.name} avatar={t.other.avatar} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-[var(--cwp-charcoal)]">{t.other.name}</p>
                          {t.lastMessage && (
                            <span className="shrink-0 text-[10px] text-[var(--cwp-text-muted)]">
                              {timeLabel(t.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-[var(--cwp-text-muted)]">
                          {t.lastMessage ? `${t.lastMessage.mine ? "You: " : ""}${t.lastMessage.body}` : roleLabel(t.other.role)}
                        </p>
                      </div>
                      {t.unread > 0 && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--cwp-olive)] px-1.5 text-[10px] font-semibold text-white">
                          {t.unread}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {view === "contacts" && (
              <ul className="divide-y divide-[var(--cwp-border)]">
                {contacts.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-[var(--cwp-text-muted)]">No contacts available.</li>
                )}
                {contacts.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => startWith(c)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-[var(--cwp-bg)]"
                    >
                      <UserAvatar name={c.name} avatar={c.avatar} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--cwp-charcoal)]">{c.name}</p>
                        <p className="truncate text-xs text-[var(--cwp-text-muted)]">
                          {roleLabel(c.role)}
                          {c.department ? ` · ${c.department}` : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {view === "chat" && (
              <div className="flex flex-col gap-2 px-3 py-3">
                {messages.length === 0 && (
                  <p className="py-8 text-center text-sm text-[var(--cwp-text-muted)]">
                    Say hello to {active?.other.name.split(" ")[0]}.
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                        m.mine
                          ? "rounded-br-sm bg-[var(--cwp-olive)] text-white"
                          : "rounded-bl-sm bg-[var(--cwp-bg)] text-[var(--cwp-charcoal)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.mine ? "text-white/70" : "text-[var(--cwp-text-muted)]"}`}>
                        {timeLabel(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Composer */}
          {view === "chat" && (
            <form onSubmit={send} className="flex items-center gap-2 border-t border-[var(--cwp-border)] p-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                className="flex-1 rounded-full border border-[var(--cwp-border)] bg-[var(--cwp-bg)] px-4 py-2 text-sm outline-none focus:border-[var(--cwp-olive)]"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="grid h-9 w-9 place-items-center rounded-full bg-[var(--cwp-olive)] text-white disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      )}

      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) openThreads();
        }}
        className="relative grid h-14 w-14 place-items-center rounded-full bg-[var(--cwp-olive)] text-white shadow-xl transition-transform hover:scale-105"
        aria-label="Messages"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--cwp-error)] px-1.5 text-[10px] font-semibold text-white ring-2 ring-[var(--cwp-surface)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}

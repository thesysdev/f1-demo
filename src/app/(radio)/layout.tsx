"use client";

import {
  agUIAdapter,
  ChatProvider,
  fetchLLM,
  openAIMessageFormat,
  useThread,
  useThreadList,
  type Thread,
} from "@openuidev/react-headless";
import { ThemeProvider } from "@openuidev/react-ui";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChatShell } from "../../components/chat-shell";
import { AskProvider } from "../../components/dashboards";
import { playTransmit } from "../../components/radio-sounds";
import { Sidebar, type SidebarThread } from "../../components/sidebar";
import { f1Theme } from "../../f1-typography";
import { messageText } from "./messages";
import { RadioThread } from "./radio-thread";
import { hasThread, localThreadStorage, saveMessages } from "./thread-storage";

/*
 * The Radio frame: what stays mounted while you move between pages. The pages are the
 * dashboards (/, /standings, /drivers, /teams), a new chat (/new) and an earlier one
 * (/[threadId]). A conversation lives in the chat store here, not in a page, so once it has
 * messages the frame shows the thread in place of the page. That is what lets the URL move
 * from /new (or a dashboard) to the new thread's address mid-answer without cutting it off.
 */

// /api/chat is stateless, so openAIMessageFormat sends the whole thread on every turn;
// agUIAdapter reads the AG-UI events the route streams back.
const llm = fetchLLM({
  url: "/api/chat",
  streamAdapter: agUIAdapter(),
  messageFormat: openAIMessageFormat,
});

// The route takes questions of up to 600 characters.
const MAX_QUESTION = 600;

// The sidebar destinations: Home is /, the others sit beside it.
const DESTINATIONS: Record<string, string> = {
  home: "/",
  standings: "/standings",
  drivers: "/drivers",
  teams: "/teams",
};

// Sidebar second line: when the conversation started.
function when(createdAt: Thread["createdAt"]) {
  const date = new Date(createdAt);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  if (days < 14) return "Last week";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function RadioFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const routeThread = useParams<{ threadId?: string }>().threadId ?? null;
  const isNewChat = pathname === "/new";
  const nav = Object.keys(DESTINATIONS).find((id) => DESTINATIONS[id] === pathname) ?? null;
  const [collapsed, setCollapsed] = useState(true);

  const threads = useThreadList((s) => s.threads);
  const selectedThreadId = useThreadList((s) => s.selectedThreadId);
  const loadThreads = useThreadList((s) => s.loadThreads);
  const selectThread = useThreadList((s) => s.selectThread);
  const switchToNewThread = useThreadList((s) => s.switchToNewThread);
  const messages = useThread((s) => s.messages);
  const isRunning = useThread((s) => s.isRunning);
  const processMessage = useThread((s) => s.processMessage);

  useEffect(loadThreads, [loadThreads]);

  // The URL picks the conversation: /[threadId] opens that thread, any other page starts a new
  // one. Decided here, once per URL, rather than in the pages: Next keeps the page you leave
  // mounted for a moment, so effects in two pages would race to set the thread. A thread this
  // browser doesn't have (another visitor's link, cleared storage) falls back to Home.
  useEffect(() => {
    if (!routeThread) switchToNewThread();
    else if (hasThread(routeThread)) selectThread(routeThread);
    else router.replace("/");
  }, [routeThread, pathname, selectThread, switchToNewThread, router]);

  // The first question creates the thread; move the URL onto it. The thread renders here, not
  // in the page, so swapping the page underneath doesn't touch the answer that's streaming.
  useEffect(() => {
    if (selectedThreadId && selectedThreadId !== routeThread) router.replace(`/${selectedThreadId}`);
    // Only when the store picks a new thread, not when the URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  const sidebarThreads = useMemo<SidebarThread[]>(
    () => threads.map((t) => ({ id: t.id, title: messageText(t.title), meta: when(t.createdAt) })),
    [threads],
  );
  // The input, suggested questions and dashboard items all ask through here, so each plays the
  // team-radio clip. Follow-up cards and retry send from the thread (radio-thread.tsx) and play it there.
  const ask = (question: string) => {
    playTransmit();
    processMessage({ role: "user", content: question.slice(0, MAX_QUESTION) });
  };

  return (
    // The carbon sidebar floats on the left; the chat page fills the rest.
    <div style={{ position: "relative", height: "100dvh", paddingLeft: collapsed ? 52 : 280, background: "#FFFFFF", transition: "padding-left 180ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
      <Sidebar
        floating
        threads={sidebarThreads}
        activeThread={routeThread}
        activeNav={isNewChat ? null : (nav ?? undefined)}
        liveThread={isRunning ? selectedThreadId : null}
        onCollapsedChange={setCollapsed}
        onNavigate={(id) => DESTINATIONS[id] && router.push(DESTINATIONS[id])}
        onOpenThread={(id) => router.push(`/${id}`)}
        onNewChat={() => (router.push("/new"), document.querySelector<HTMLInputElement>(".radio-input input")?.focus())}
      />
      {/* Anything picked on a page (a dashboard item, a suggested question) starts a chat with it. */}
      <AskProvider value={ask}>
        <ChatShell
          threadKey={routeThread ?? pathname}
          // A new chat sits centred on its welcome; a dashboard runs full width from the top.
          empty={isNewChat ? children : null}
          page={isNewChat ? null : children}
          input={{
            busy: isRunning,
            maxLength: MAX_QUESTION,
            // ask() plays the team-radio clip; typing stays silent.
            onSend: ask,
          }}
        >
          {messages.length > 0 && <RadioThread />}
        </ChatShell>
      </AskProvider>
    </div>
  );
}

// Keeps each thread's messages in local storage: right away when a run ends, and
// at most once a second while one streams.
function PersistThread() {
  const threadId = useThreadList((s) => s.selectedThreadId);
  const messages = useThread((s) => s.messages);
  const isRunning = useThread((s) => s.isRunning);
  const isLoading = useThread((s) => s.isLoadingMessages);
  const lastSave = useRef(0);
  useEffect(() => {
    if (!threadId || isLoading || !messages.length) return;
    const now = Date.now();
    if (isRunning && now - lastSave.current < 1000) return;
    lastSave.current = now;
    saveMessages(threadId, messages);
  }, [threadId, messages, isRunning, isLoading]);
  return null;
}

export default function RadioLayout({ children }: { children: ReactNode }) {
  // A public demo with no accounts: threads live only in each visitor's browser (localStorage),
  // and nothing is stored on a server.
  return (
    <ThemeProvider mode="light" lightTheme={f1Theme}>
      <ChatProvider llm={llm} storage={localThreadStorage}>
        <PersistThread />
        <RadioFrame>{children}</RadioFrame>
      </ChatProvider>
    </ThemeProvider>
  );
}

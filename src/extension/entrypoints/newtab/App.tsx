import { useCallback, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, GitPullRequest, Inbox, PanelRight, Play, Search, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { browser } from 'wxt/browser';

import { AgentChip } from '@/extension/components/agent-chip';
import { AgentPicker } from '@/extension/components/agent-picker';
import { CatMascot, Wordmark } from '@/extension/components/brand';
import { Composer, type AttachedSkill } from '@/extension/components/composer';
import { DaemonLink } from '@/extension/components/daemon-link';
import { DropMask } from '@/extension/components/drop-mask';
import { FrequentSites } from '@/extension/components/frequent-sites';
import { HomeCustomize } from '@/extension/components/home-customize';
import { Popover } from '@/extension/components/popover';
import { RecentConversations } from '@/extension/components/recent-conversations';
import { RunCard } from '@/extension/components/run-card';
import { SavedToolList } from '@/extension/components/saved-tools';
import { StatusPill, describeStatus, type StatusBlocker } from '@/extension/components/status-pill';
import { Button } from '@/extension/components/ui/button';
import { BRIDGE_CHANNEL } from '@/lib/actions/protocol';
import { isRemoveToolsCommand } from '@/lib/bridge/commands';
import { showPanelTab } from '@/lib/bridge/panel-view';
import { hasSidePanel, openSidePanel } from '@/lib/bridge/side-panel';
import { useOwnTab } from '@/lib/bridge/use-active-tab';
import { useAttachFiles } from '@/lib/bridge/use-attach-files';
import { useDaemonState } from '@/lib/bridge/use-daemon-state';
import { useActionCues, useNewTabChoice } from '@/lib/bridge/use-extension-settings';
import { useFileDrop } from '@/lib/bridge/use-file-drop';
import { useFrequentSites } from '@/lib/bridge/use-frequent-sites';
import { useRun } from '@/lib/bridge/use-run';
import { useStoredFiles } from '@/lib/bridge/use-stored-files';
import { useStoredSessions } from '@/lib/bridge/use-stored-sessions';
import { useVoiceComposer } from '@/lib/bridge/use-voice-composer';
import { MAX_STORED_FILE_BYTES } from '@/lib/files/report';
import { greeting } from '@/lib/home/greeting';
import { summarize } from '@/lib/home/run-summary';
import { suggestionsFor } from '@/lib/home/suggestions';
import { hideSite } from '@/lib/settings/new-tab';

type Sheet = 'connection' | 'agent' | 'customize';

const RECENT = 3;

const QUICK_ACTIONS = [
  { title: 'YouTube subscriptions', prompt: 'List the new videos from my YouTube subscriptions', icon: Play, detail: 'Catch up on new videos' },
  { title: 'GitHub pull requests', prompt: 'List the pull requests waiting on my review', icon: GitPullRequest, detail: 'See what needs your review' },
  { title: 'Unread email', prompt: 'Summarise my unread email', icon: Inbox, detail: 'Find messages that need a reply' },
] as const;

const TOPIC_GROUPS = [
  { title: 'Everyday', icon: BriefcaseBusiness, prompts: ['Summarise my unread messages and highlight anything urgent', 'What should I take care of first today?'] },
  { title: 'Research', icon: Search, prompts: ['Summarise the top stories on Hacker News', 'Compare a few reliable sources about a topic'] },
  { title: 'Shopping', icon: ShoppingBag, prompts: ['Compare the best-reviewed noise-cancelling headphones', 'Find the best price for an item I am considering'] },
] as const;

const SETUP: Record<StatusBlocker, { text: string; action: string; sheet: Sheet }> = {
  unpaired: { text: 'This browser isn’t connected to Tuhamho Brow Bridge yet.', action: 'Set up the link', sheet: 'connection' },
  offline: { text: 'Tuhamho Brow Bridge isn’t answering. Start it and this reconnects on its own.', action: 'Check the link', sheet: 'connection' },
  agent: { text: 'The chosen agent can’t run on this computer.', action: 'Choose another agent', sheet: 'agent' },
};

const composerField = () => document.querySelector<HTMLTextAreaElement>('textarea[data-slot="textarea"]');

const TYPING_TARGETS = 'input, textarea, select, button, a, [contenteditable="true"]';

export default function App({ onTurnOff }: { onTurnOff: () => void }) {
  const daemon = useDaemonState();
  const own = useOwnTab();
  const run = useRun(own);
  const [choice, setChoice] = useNewTabChoice();
  const frequent = useFrequentSites(choice.sites, choice.hidden);
  const stored = useStoredSessions();
  const storedFiles = useStoredFiles();
  const [micOn, setMicOn] = useState(false);
  const [actionCues, setActionCues] = useActionCues();
  const [liveTools, setLiveTools] = useState(false);
  const [attachedSkill, setAttachedSkill] = useState<AttachedSkill | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const attachFiles = useAttachFiles(run.attachFile, setAttachError);
  const [showTools, setShowTools] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const toggle = (next: Sheet) => setSheet((open) => (open === next ? null : next));

  const panel = hasSidePanel();
  const connected = daemon?.connected ?? false;

  /** Must run first in a click or key press: the browser opens a side panel only while the gesture is fresh. */
  function reveal() {
    if (panel && own.windowId != null) void openSidePanel(own.windowId).catch(() => undefined);
  }

  /* Per page, not the panel's stored switch: new tabs open all day, and none may start listening on its own. */
  const voice = useVoiceComposer({
    active: micOn && connected && !run.running,
    onSubmit: (text) => {
      reveal();
      run.send(text, { agentSkillId: attachedSkill?.id, liveTools });
      setAttachedSkill(null);
    },
  });

  const dragging = useFileDrop({ active: connected, onDrop: (dropped) => void attachFiles(dropped) });

  useEffect(() => {
    if (!connected || daemon?.skillCatalog) return;
    void browser.runtime.sendMessage({ channel: BRIDGE_CHANNEL, op: 'listSkills' });
  }, [connected, daemon?.skillCatalog]);

  useEffect(() => {
    const typed = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1) return;
      if ((event.target as HTMLElement).closest(TYPING_TARGETS)) return;
      composerField()?.focus();
    };
    document.addEventListener('keydown', typed);
    return () => document.removeEventListener('keydown', typed);
  }, []);

  const status = describeStatus(daemon, { running: run.running, listening: voice.listening });
  const files = useMemo(
    () => storedFiles.filter((file) => file.sessionId !== undefined && file.sessionId === run.sessionId),
    [storedFiles, run.sessionId],
  );
  const summary = useMemo(
    () => summarize(run.items.filter((item) => !(item.kind === 'tool' && item.source === 'external')), run.running),
    [run.items, run.running],
  );
  const ideas = useMemo(() => suggestionsFor(frequent.sites.map((site) => site.host)), [frequent.sites]);
  const siteIdeas = ideas.filter((idea) => !QUICK_ACTIONS.some(({ prompt }) => prompt === idea));
  const running = run.sessions.filter((session) => session.runId && session.sessionId !== run.sessionId);
  const recent = stored
    .filter((session) => session.id !== run.sessionId && !running.some((live) => live.sessionId === session.id))
    .slice(0, RECENT);
  const hello = greeting(new Date().getHours(), daemon?.preferences?.profile.fields.givenName);
  const setup = status.blocker && SETUP[status.blocker];

  function send() {
    if (!connected || run.running) return;
    voice.submitNow();
  }

  function command(text: string) {
    if (isRemoveToolsCommand(text)) {
      setShowTools(true);
      return;
    }
    reveal();
    run.send(text);
  }

  function use(text: string) {
    voice.setInput(text);
    composerField()?.focus();
  }

  function toggleVoice() {
    if (micOn && voice.error) voice.retry();
    else setMicOn(!micOn);
  }

  function openConversation(sessionId: string) {
    reveal();
    void run.restore(sessionId);
  }

  function watch(sessionId: string) {
    reveal();
    run.focusSession(sessionId);
  }

  function showAll() {
    reveal();
    void showPanelTab('history');
  }

  function turnOff() {
    setChoice({ ...choice, home: false });
    onTurnOff();
  }

  return (
    <div className="home-page relative flex min-h-screen flex-col overflow-x-clip bg-ground text-ink">
      <div aria-hidden className="dot-grid pointer-events-none fixed inset-0" />
      <div aria-hidden className="pointer-events-none fixed -top-44 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brand)_10%,transparent)_0%,transparent_70%)]" />

      <header className="relative z-20 flex items-center gap-2 border-b border-line bg-ground px-5 py-3.5">
        <Wordmark />
        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <StatusPill tone={status.tone} expanded={sheet === 'connection'} onClick={() => toggle('connection')}>
              {status.label}
            </StatusPill>
            <Popover open={sheet === 'connection'} label="Connection" onClose={closeSheet}>
              <div className="space-y-4">
                <DaemonLink />
                <AgentPicker />
              </div>
            </Popover>
          </div>
          {panel && (
            <Button variant="ghost" size="icon-sm" title="Open the side panel" aria-label="Open the side panel" onClick={reveal}>
              <PanelRight className="size-3.5" />
            </Button>
          )}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Customize"
              aria-label="Customize this page"
              aria-expanded={sheet === 'customize'}
              onClick={() => toggle('customize')}
            >
              <SlidersHorizontal className="size-3.5" />
            </Button>
            <Popover open={sheet === 'customize'} label="Customize" onClose={closeSheet}>
              <HomeCustomize choice={choice} onChange={setChoice} onTurnOff={turnOff} />
            </Popover>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-[72rem] flex-1 flex-col px-5 pt-7 pb-12 sm:px-8">
        <section className="relative grid min-h-[176px] grid-cols-[minmax(0,1fr)_104px] items-center overflow-hidden rounded-[26px] border border-line bg-ground-2 px-5 py-5 sm:min-h-[210px] sm:grid-cols-[1fr_220px] sm:px-9 sm:py-5">
          <div aria-hidden className="pointer-events-none absolute -right-28 -top-36 size-[440px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brand)_13%,transparent)_0%,transparent_69%)]" />
          <div className="relative z-10 py-1">
            <p className="font-mono text-[10px] font-semibold tracking-[0.2em] text-brand uppercase">Tuhamho Brow <span className="text-ink-faint">/</span> Local agent</p>
            <h1 className="mt-3 font-display text-3xl leading-tight font-semibold tracking-tight text-ink sm:text-[2.65rem]">{hello}</h1>
            <p className="mt-2 max-w-[34rem] text-sm leading-relaxed text-ink-dim">Your browser is ready. Tell Tuhamho what to do, or pick a task to get started.</p>
          </div>
          <div className="pointer-events-none relative flex h-full min-h-[104px] items-end justify-center overflow-hidden sm:min-h-[190px]">
            <CatMascot className="relative z-10 h-[110px] w-[110px] translate-y-2 rounded-full sm:h-[224px] sm:w-[224px] sm:translate-y-4" />
            <span aria-hidden className="absolute bottom-1 size-[94px] rounded-full border border-brand/15 sm:bottom-3 sm:size-[190px]" />
          </div>
        </section>

        <div className="relative mt-5">
          <div aria-hidden className="home-halo pointer-events-none absolute -inset-x-10 -inset-y-8" />
          <div className="relative">
            <Composer
              size="hero"
              voice={voice}
              voiceEnabled={micOn}
              connected={connected}
              running={run.running}
              files={files}
              attachError={attachError}
              catalog={daemon?.skillCatalog}
              tabUrl=""
              attachedSkill={attachedSkill}
              focus={null}
              picking={false}
              liveTools={liveTools}
              onToggleLiveTools={() => setLiveTools((on) => !on)}
              actionCues={actionCues}
              onToggleActionCues={() => setActionCues(!actionCues)}
              onAttachSkill={setAttachedSkill}
              handsFree={false}
              placeholder="Tell Tuhamho what to do, or where to go…"
              accessory={
                <div className="relative min-w-0">
                  <AgentChip state={daemon?.agent} expanded={sheet === 'agent'} onClick={() => toggle('agent')} />
                  <Popover open={sheet === 'agent'} label="Agent" onClose={closeSheet}>
                    <AgentPicker />
                  </Popover>
                </div>
              }
              onCommand={command}
              tools={run.tools}
              onRunTool={(id) => {
                reveal();
                run.runTool(id);
              }}
              onSend={send}
              onStop={run.cancel}
              onToggleVoice={toggleVoice}
              onClearFocus={() => undefined}
              onAttachFile={(file) => void attachFiles([file])}
              onRemoveFile={run.detachFile}
              onRetryFile={run.reanalyzeFile}
            />
          </div>
        </div>

        <div className="mt-4">
          {setup ? (
            <div className="enters flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl border border-amber/30 bg-amber/8 px-4 py-3 text-center">
              <p className="text-sm text-ink">{setup.text}</p>
              <Button size="sm" variant="outline" onClick={() => setSheet(setup.sheet)}>
                {setup.action}
              </Button>
            </div>
          ) : summary.phase !== 'idle' ? (
            <RunCard
              summary={summary}
              onOpenPanel={panel ? reveal : undefined}
              onDecide={(toolId, allow) => run.decide(toolId, allow)}
              onDismiss={run.clear}
            />
          ) : null}
        </div>

        <section className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="rounded-2xl border border-line bg-ground-2 p-4 sm:p-5 lg:col-span-7">
            <BentoHeading eyebrow="Start here" title="Quick actions" />
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {QUICK_ACTIONS.map(({ title, prompt, icon: Icon, detail }) => (
                <button key={title} type="button" onClick={() => use(prompt)} className="group min-h-[112px] rounded-xl border border-line bg-ground px-3.5 py-3 text-left transition-colors hover:border-brand/45 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-ground-2 text-brand"><Icon className="size-4" strokeWidth={1.7} /></span>
                  <span className="mt-2.5 block text-[12px] font-semibold text-ink">{title}</span>
                  <span className="mt-0.5 block text-[10px] text-ink-faint">{detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-ground-2 p-4 sm:p-5 lg:col-span-5">
            <div className="flex items-start justify-between gap-2">
              <BentoHeading eyebrow="Pick up where you left off" title="Recent commands" />
              {recent.length > 0 && panel && <button type="button" onClick={showAll} className="pt-1 text-[10px] text-ink-faint hover:text-brand">View all</button>}
            </div>
            {running.length || recent.length ? (
              <div className="mt-2"><RecentConversations running={running} recent={recent} onWatch={watch} onOpen={openConversation} onShowAll={panel ? showAll : undefined} showHeading={false} /></div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-5 text-xs leading-relaxed text-ink-faint">Your recent tasks will appear here after you ask Tuhamho to do something.</p>
            )}
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-line bg-ground-2 p-4 sm:p-5">
          <BentoHeading eyebrow="Ideas for your next task" title="Explore by topic" />
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            {TOPIC_GROUPS.map(({ title, icon: Icon, prompts }) => (
              <div key={title} className="rounded-xl border border-line bg-ground p-3.5">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-ink"><Icon className="size-3.5 text-brand" strokeWidth={1.8} />{title}</h3>
                <div className="mt-2 space-y-1.5">
                  {prompts.map((prompt) => <button key={prompt} type="button" onClick={() => use(prompt)} className="block w-full rounded-lg px-2 py-1.5 text-left text-[11px] leading-snug text-ink-dim transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{prompt}</button>)}
                </div>
              </div>
            ))}
          </div>
          {!!siteIdeas.length && <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3"><span className="mr-1 text-[10px] text-ink-faint">For your sites</span>{siteIdeas.map((text) => <button key={text} type="button" onClick={() => use(text)} className="rounded-lg border border-line px-2.5 py-1.5 text-[10px] text-ink-dim transition-colors hover:border-brand/40 hover:text-ink">{text}</button>)}</div>}
        </section>

        {choice.sites && <div className="mt-4"><FrequentSites frequent={frequent} onHide={(host) => setChoice(hideSite(choice, host))} /></div>}
      </main>

      {showTools && (
        <SavedToolList
          tools={run.tools}
          autoRunReady={run.autoRunReady}
          onAutoRun={run.setAutoRun}
          onForget={run.forgetTool}
          onClose={() => setShowTools(false)}
        />
      )}
      {dragging && <DropMask connected={connected} maxBytes={MAX_STORED_FILE_BYTES} />}
    </div>
  );
}

function BentoHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-[9px] font-semibold tracking-[0.15em] text-brand uppercase">{eyebrow}</p><h2 className="mt-0.5 font-display text-sm font-semibold text-ink">{title}</h2></div>;
}

import { CircleHelp, Cpu, Globe, Info, Languages, Power, Settings, ShieldCheck, Smartphone, type LucideIcon } from 'lucide-react';

import { CatMascot } from '@/extension/components/brand';
import { cn } from '@/lib/utils';
import { useLanguage } from '../language';
import { TABS, type Model, type State, type Tab } from '../model';
import { AboutView } from './about';
import { AndroidView } from './android';
import { BrowsersView } from './browsers';
import { OverviewView } from './overview';
import { SettingsScreen } from './settings-screen';

const TAB: Record<Tab, { label: string; icon: LucideIcon; view: typeof OverviewView; badge?: string }> = {
  overview: { label: 'Overview', icon: Power, view: OverviewView },
  browsers: { label: 'Browsers', icon: Globe, view: BrowsersView },
  android: { label: 'Android', icon: Smartphone, view: AndroidView, badge: 'Beta' },
  settings: { label: 'Settings', icon: Settings, view: SettingsScreen },
  about: { label: 'About', icon: Info, view: AboutView },
};

export function MainView({ model, state }: { model: Model; state: State }) {
  const { language, setLanguage, t } = useLanguage();
  const View = TAB[state.tab].view;
  const running = state.daemon === 'on';
  return (
    <div className="relative flex h-full min-w-0">
      <aside className="relative z-10 flex w-[230px] shrink-0 flex-col border-r border-line bg-ground-2 px-3 py-5">
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-line bg-ground px-3 py-3">
          <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl border border-brand/30 bg-surface">
            <CatMascot className="size-10" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-[15px] font-bold tracking-tight text-ink">Tuhamho Brow</span>
            <span className="mt-1 block text-[9px] font-semibold tracking-[0.16em] text-ink-faint uppercase">{t('Local browser agent', 'Trợ lý trình duyệt cục bộ')}</span>
          </span>
        </div>

        <p className="px-3 pb-2 text-[9px] font-bold tracking-[0.16em] text-ink-faint uppercase">{t('Workspace', 'Không gian làm việc')}</p>
        <nav aria-label="Main navigation" className="flex flex-col gap-1">
          {TABS.map((tab, index) => {
            const { icon: Icon } = TAB[tab];
            const label = t(TAB[tab].label, ({ overview: 'Tổng quan', browsers: 'Trình duyệt', android: 'Android', settings: 'Cài đặt', about: 'Giới thiệu' } as const)[tab]);
            const badge = TAB[tab].badge ? t('Beta', 'Thử nghiệm') : undefined;
            const selected = state.tab === tab;
            return (
              <button
                key={tab}
                type="button"
                title={`${label} (Ctrl+${index + 1})`}
                aria-current={selected ? 'page' : undefined}
                onClick={() => model.setTab(tab)}
                className={cn(
                  'group flex h-10 items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-colors',
                  selected ? 'bg-brand/12 text-brand shadow-[inset_2px_0_0_var(--brand)]' : 'text-ink-dim hover:bg-surface hover:text-ink',
                )}
              >
                <Icon className="size-[17px] shrink-0" strokeWidth={2} />
                <span className="flex-1">{label}</span>
                {badge && <span className="rounded-md border border-amber/30 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-amber uppercase">{badge}</span>}
                {tab === 'overview' && state.update && <span className="size-1.5 rounded-full bg-brand" />}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 px-2">
          <div className="rounded-2xl border border-line bg-ground p-3.5">
            <div className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', running ? 'bg-lime' : state.daemon === 'starting' ? 'bg-amber' : 'bg-ink-faint')} />
              <span className="text-[11px] font-semibold text-ink">{t('Bridge', 'Bridge')} {running ? t('running', 'đang chạy') : state.daemon === 'off' ? t('offline', 'đang tắt') : state.daemon}</span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
              <Cpu className="size-3" /> {state.status ? `127.0.0.1:${state.status.port}` : 'Local connection'}
            </p>
          </div>
          <button type="button" onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-[11px] font-medium text-ink-dim transition hover:bg-surface/70 hover:text-ink">
            <Languages className="size-3.5" /> {language === 'en' ? 'Tiếng Việt' : 'English'}
          </button>
          <p className="flex items-center gap-1.5 px-1 text-[10px] text-ink-faint"><ShieldCheck className="size-3" /> {t('Runs on this computer', 'Chạy trên máy tính này')}</p>
        </div>
      </aside>

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-line bg-ground px-7">
          <div>
            <p className="text-[9px] font-bold tracking-[0.16em] text-brand uppercase">Tuhamho Brow</p>
            <h1 className="mt-0.5 font-display text-[17px] font-semibold text-ink">{t(TAB[state.tab].label, ({ overview: 'Tổng quan', browsers: 'Trình duyệt', android: 'Android', settings: 'Cài đặt', about: 'Giới thiệu' } as const)[state.tab])}</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1.5">
            <span className={cn('size-1.5 rounded-full', running ? 'bg-lime' : 'bg-ink-faint')} />
            <span className="text-[10px] font-medium text-ink-dim">{running ? t('All systems local', 'Mọi dịch vụ đang chạy cục bộ') : t('Bridge offline', 'Bridge đang tắt')}</span>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--line-strong)_transparent]">
          <div key={state.tab} className={cn('enter mx-auto w-full px-7 py-7', state.tab === 'settings' ? 'max-w-[1080px]' : 'max-w-[960px]')}>
            <View model={model} state={state} />
            <div className="mt-8 flex items-center justify-center gap-1.5 text-[10px] text-ink-faint"><CircleHelp className="size-3" /> {t('Tuhamho Brow · local-first browser automation', 'Tuhamho Brow · tự động hóa trình duyệt ngay trên máy')}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

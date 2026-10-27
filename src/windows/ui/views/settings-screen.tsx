import { AlignLeft, BookOpen, ShieldCheck, SlidersHorizontal, Sparkles, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useLanguage } from '../language';
import { SETTINGS_SECTIONS, type Model, type SettingsSection, type State } from '../model';
import { ActivityView } from './activity';
import { AgentsView } from './agents';
import { LogsView } from './logs';
import { SettingsView } from './settings';
import { SkillsView } from './skills';

const SECTION: Record<SettingsSection, { label: string; icon: LucideIcon; view: typeof SettingsView }> = {
  general: { label: 'General', icon: SlidersHorizontal, view: SettingsView },
  agents: { label: 'Agents', icon: Sparkles, view: AgentsView },
  skills: { label: 'Skills', icon: BookOpen, view: SkillsView },
  activity: { label: 'Activity', icon: ShieldCheck, view: ActivityView },
  logs: { label: 'Logs', icon: AlignLeft, view: LogsView },
};

/** Settings, with the pages that once had tabs of their own, picked from a sidebar that stays put while a page scrolls. */
export function SettingsScreen({ model, state }: { model: Model; state: State }) {
  const { t } = useLanguage();
  const View = SECTION[state.settingsSection].view;
  return (
    <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:gap-7">
      <nav aria-label="Settings sections" className="flex w-full shrink-0 flex-wrap gap-1 border-b border-line pb-2 lg:sticky lg:top-16 lg:w-42 lg:flex-col lg:flex-nowrap lg:border-0 lg:pb-0">
        {SETTINGS_SECTIONS.map((section) => {
          const { icon: Icon } = SECTION[section];
          const label = t(SECTION[section].label, ({ general: 'Chung', agents: 'Agent', skills: 'Kỹ năng', activity: 'Hoạt động', logs: 'Nhật ký' } as const)[section]);
          const active = state.settingsSection === section;
          return (
            <button
              key={section}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => model.openSettings(section)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm',
                active ? 'bg-brand/12 text-brand' : 'text-ink-faint hover:bg-surface/60 hover:text-ink-dim',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </nav>
      <div key={state.settingsSection} className="enter min-w-0 flex-1">
        <View model={model} state={state} />
      </div>
    </div>
  );
}

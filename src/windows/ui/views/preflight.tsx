import {
  ArrowRight,
  CircleAlert,
  CircleArrowDown,
  CircleCheck,
  Globe,
  Hexagon,
  Languages,
  Monitor,
  OctagonX,
  RefreshCw,
  Sparkles,
  SquareTerminal,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';

import { Logo } from '@/extension/components/brand';
import { cn } from '@/lib/utils';
import { useLanguage } from '../language';
import { PrimaryButton, QuietButton, Spinner } from '../components';
import { CHECKS, INSTALLS_AUTOMATICALLY, needsAttention, type CheckId, type CheckState, type Model, type State } from '../model';

const CHECK: Record<CheckId, { title: string; icon: LucideIcon }> = {
  system: { title: 'This computer', icon: Monitor },
  node: { title: 'Node.js runtime', icon: Hexagon },
  command: { title: 'Browsentic Bridge', icon: SquareTerminal },
  browser: { title: 'A browser', icon: Globe },
  agent: { title: 'An AI agent', icon: Sparkles },
};

export function PreflightView({ model, state }: { model: Model; state: State }) {
  const { language, setLanguage, t } = useLanguage();
  const headline = state.fixing
    ? 'Installing what is missing'
    : state.preflightBusy
      ? 'Checking what this computer already has'
      : model.needsSetup
        ? 'A few things are missing. One click installs them'
        : 'Everything is in place';

  return (
    <div className="enter relative flex h-full flex-col items-center overflow-y-auto px-6">
      <button type="button" onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')} className="absolute top-5 right-6 flex items-center gap-2 rounded-lg border border-line bg-surface/70 px-3 py-2 text-xs font-medium text-ink-dim hover:text-ink">
        <Languages className="size-3.5" /> {language === 'en' ? 'Tiếng Việt' : 'English'}
      </button>
      <div className="min-h-4 flex-1" />
      <Beacon active={state.preflightBusy || state.fixing} settled={model.canEnter && !state.preflightBusy} />
      <h1 className="mt-3 font-display text-[30px] font-bold text-ink">Tuhamho Brow</h1>
      <p className="mt-1 text-[13px] text-ink-dim">{t(headline, ({
        'Installing what is missing': 'Đang cài đặt thành phần còn thiếu',
        'Checking what this computer already has': 'Đang kiểm tra máy tính',
        'A few things are missing. One click installs them': 'Còn thiếu một vài thành phần. Nhấn một lần để cài đặt',
        'Everything is in place': 'Mọi thứ đã sẵn sàng',
      } as const)[headline])}</p>

      <div className="mt-5 w-[600px] max-w-full space-y-1.5">
        {CHECKS.map((id) => (
          <CheckRow key={id} id={id} state={state.checks[id]} model={model} busy={state.fixing || state.preflightBusy} hasNode={!!state.node} />
        ))}
      </div>

      <div className="mt-4 flex h-10 shrink-0 items-center gap-2.5">
        {!state.preflightBusy &&
          (model.needsSetup ? (
            <PrimaryButton icon={WandSparkles} disabled={state.fixing} onClick={() => void model.setUpEverything()}>
              {state.fixing ? t('Setting up…', 'Đang thiết lập…') : t('Set up everything', 'Thiết lập tất cả')}
            </PrimaryButton>
          ) : (
            <PrimaryButton icon={ArrowRight} onClick={() => model.enter()}>
              {t('Open Tuhamho Brow', 'Mở Tuhamho Brow')}
            </PrimaryButton>
          ))}
        {!state.preflightBusy && (
          <QuietButton icon={RefreshCw} disabled={state.fixing} onClick={() => void model.runPreflight()}>
            {t('Check again', 'Kiểm tra lại')}
          </QuietButton>
        )}
      </div>

      <div className="min-h-4 flex-1" />
      <p className="pb-4 text-[11px] text-ink-faint">
        {t('Everything Tuhamho Brow installs stays in your user folder. No administrator or account needed.', 'Tuhamho Brow chỉ cài trong thư mục người dùng. Không cần quyền quản trị hay tài khoản.')}
      </p>
    </div>
  );
}

/** The loading mark: the brand glyph inside two counter-rotating arcs and a breathing halo. */
function Beacon({ active, settled }: { active: boolean; settled: boolean }) {
  return (
    <div className="relative size-[148px] shrink-0">
      <div className="breathe absolute inset-0 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_35%,transparent),transparent)]" />
      <div
        className="ring spin inset-1.5"
        style={{
          ['--spin' as string]: '2.6s',
          ['--ring-width' as string]: '2.5px',
          background: active
            ? 'conic-gradient(from 0deg, transparent 0 38%, var(--brand) 70%, var(--ember) 100%)'
            : 'conic-gradient(var(--brand), var(--ember), var(--brand))',
        }}
      />
      {active && (
        <div
          className="ring spin-reverse inset-4"
          style={{ ['--spin' as string]: '2.6s', ['--ring-width' as string]: '1.5px', background: 'conic-gradient(color-mix(in oklch, var(--magenta) 80%, transparent) 0 30%, transparent 30%)' }}
        />
      )}
      <div
        className={cn(
          'absolute top-1/2 left-1/2 flex size-[92px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[22px] border border-line-strong bg-gradient-to-b from-surface to-ground transition-transform duration-700',
          settled ? 'scale-104 shadow-[0_0_26px_color-mix(in_oklch,var(--lime)_calc(var(--glow)*0.7),transparent)]' : 'shadow-[0_0_26px_color-mix(in_oklch,var(--brand)_calc(var(--glow)*0.7),transparent)]',
        )}
      >
        <Logo className="size-[68px] text-brand" />
      </div>
    </div>
  );
}

function CheckRow({ id, state, model, busy, hasNode }: { id: CheckId; state: CheckState; model: Model; busy: boolean; hasNode: boolean }) {
  const { t } = useLanguage();
  const { title: englishTitle, icon: Icon } = CHECK[id];
  const title = t(englishTitle, ({ system: 'Máy tính này', node: 'Node.js runtime', command: 'Tuhamho Brow Bridge', browser: 'Trình duyệt', agent: 'AI agent' } as const)[id]);
  const detail =
    state.kind === 'waiting' ? 'Waiting' : state.kind === 'checking' ? 'Checking…' : state.text;
  const action = busy
    ? null
    : id === 'browser' && state.kind === 'advisory'
      ? { label: 'Get Chrome', fix: () => model.fix('browser') }
      : id === 'agent' && state.kind === 'advisory' && hasNode
        ? { label: 'Install Claude Code', fix: () => model.fix('agent') }
        : needsAttention(state) && INSTALLS_AUTOMATICALLY.includes(id)
          ? { label: 'Install', fix: () => model.fix(id) }
          : null;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-3 rounded-[14px] border bg-surface/72 px-3.5 py-2 transition-opacity',
        needsAttention(state) ? 'border-amber/45' : 'border-line',
        state.kind === 'waiting' && 'opacity-45',
      )}
    >
      <span className="flex size-7.5 shrink-0 items-center justify-center rounded-[9px] bg-ground-2">
        <Icon className={cn('size-3.5', state.kind === 'waiting' ? 'text-ink-faint' : 'text-brand')} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        <p className={cn('line-clamp-2 text-[11.5px]', state.kind === 'failed' ? 'text-destructive' : 'text-ink-dim')}>{detail}</p>
        {state.kind === 'working' && state.fraction !== undefined && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ground-2">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round(state.fraction * 100)}%` }} />
          </div>
        )}
      </div>
      {action && <QuietButton onClick={() => void action.fix()}>{action.label}</QuietButton>}
      <span className="flex w-5.5 justify-center">
        <Indicator state={state} />
      </span>
    </div>
  );
}

function Indicator({ state }: { state: CheckState }) {
  switch (state.kind) {
    case 'waiting':
      return <span className="size-4 rounded-full border-[1.5px] border-line-strong" />;
    case 'checking':
    case 'working':
      return <Spinner />;
    case 'passed':
      return <CircleCheck className="size-4.5 text-lime" />;
    case 'missing':
      return <CircleArrowDown className="size-4.5 text-amber" />;
    case 'advisory':
      return <CircleAlert className="size-4.5 text-amber" />;
    case 'failed':
      return <OctagonX className="size-4.5 text-destructive" />;
  }
}

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Cpu, FileDown, KeyRound, Network, Power, Puzzle, RefreshCw, SquareArrowOutUpRight, Wrench, type LucideIcon } from 'lucide-react';

import type { BrowserRow } from '@/daemon/browsers';
import { SOURCE_LABEL } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { useLanguage } from '../language';
import { Card, CopyButton, GlowDot, PathRow, Pill, PrimaryButton, QuietButton, SectionTitle, Step, type Tint } from '../components';
import type { DaemonPhase, Model, State } from '../model';
import type { PairingCode } from '../backend';
import { UpdateCard } from './update-card';

const TINT: Record<DaemonPhase, Tint> = { on: 'lime', off: 'faint', starting: 'amber', stopping: 'amber' };
const LABEL: Record<DaemonPhase, string> = { off: 'Off', starting: 'Starting', on: 'Running', stopping: 'Stopping' };

export function OverviewView({ model, state }: { model: Model; state: State }) {
  const { t } = useLanguage();
  const { daemon, status, lock } = state;
  const connected = status?.connected === true;
  const title = {
    on: connected ? 'Your browser is connected' : 'Waiting for your browser',
    off: 'Tuhamho Brow is off',
    starting: 'Starting the Bridge',
    stopping: 'Shutting down',
  }[daemon];
  const subtitle = {
    on: connected
      ? 'Open the Tuhamho Brow side panel and tell it what to do. The Bridge keeps running if you close this window.'
      : model.pairsByItself
        ? 'The local Bridge is ready. Load the bundled extension below to connect your browser.'
        : 'The local Bridge is ready. Load the bundled extension and pair once to connect your browser.',
      off: 'Turn on the local Bridge to let your browser reach the agent you already run.',
    starting: 'One moment.',
    stopping: 'One moment.',
  }[daemon];

  return (
    <div className="space-y-4.5">
      {state.update && <UpdateCard model={model} state={state} />}

      <Card className="relative overflow-hidden p-6.5 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brand/60 before:to-transparent">
        <div className="relative flex items-center gap-6">
          <PowerOrb phase={daemon} onToggle={() => void model.setDaemon(daemon === 'off')} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <GlowDot tint={TINT[daemon]} pulsing={daemon === 'on'} />
              <span className={cn('text-[11px] font-bold tracking-[0.11em] uppercase', TEXT_TINT[TINT[daemon]])}>{t(LABEL[daemon], ({ on: 'Đang chạy', off: 'Đã tắt', starting: 'Đang khởi động', stopping: 'Đang dừng' } as const)[daemon])}</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-ink">{t(title, ({ 'Your browser is connected': 'Trình duyệt đã kết nối', 'Waiting for your browser': 'Đang chờ trình duyệt', 'Tuhamho Brow is off': 'Tuhamho Brow đang tắt', 'Starting the Bridge': 'Đang khởi động Bridge', 'Shutting down': 'Đang tắt Bridge' } as const)[title] ?? title)}</h1>
            <p className="text-[13px] text-ink-dim">{t(subtitle, ({
              'Open the Tuhamho Brow side panel and tell it what to do. The Bridge keeps running if you close this window.': 'Mở bảng bên Tuhamho Brow và nhập yêu cầu. Bridge vẫn chạy khi bạn đóng cửa sổ này.',
              'The local Bridge is ready. Load the bundled extension below to connect your browser.': 'Bridge đã sẵn sàng. Nạp extension đi kèm bên dưới để kết nối trình duyệt.',
              'The local Bridge is ready. Load the bundled extension and pair once to connect your browser.': 'Bridge đã sẵn sàng. Nạp extension đi kèm và ghép nối một lần để kết nối trình duyệt.',
              'Turn on the local Bridge to let your browser reach the agent you already run.': 'Bật Bridge để trình duyệt kết nối với agent bạn đang dùng.',
              'One moment.': 'Vui lòng chờ một chút.',
            } as const)[subtitle] ?? subtitle)}</p>
            {daemon === 'on' && (
              <QuietButton icon={RefreshCw} className="mt-1" disabled={state.busy.includes('restart')} onClick={() => void model.restartDaemon()}>
                {t('Restart', 'Khởi động lại')}
              </QuietButton>
            )}
          </div>
        </div>
      </Card>

      {status && lock && (
    <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
          <Stat label={t('Address', 'Địa chỉ')} value={`127.0.0.1:${status.port}`} icon={Network} />
          <Stat label={t('Bridge', 'Bridge')} value={`v${status.daemonVersion}`} detail={`pid ${lock.pid}`} icon={Cpu} />
          <Stat
            label={t('Extension', 'Extension')}
            value={connected ? t('Connected', 'Đã kết nối') : t('Not connected', 'Chưa kết nối')}
            detail={status.extensionVersion && `v${status.extensionVersion}`}
            icon={Puzzle}
            tint={connected ? 'lime' : 'amber'}
          />
          <Stat
            label={t('Tools', 'Công cụ')}
            value={status.manifestInSync ? t('In sync', 'Đồng bộ') : t('The extension’s', 'Extension')}
            detail={status.manifestInSync ? undefined : 'versions differ, which is fine'}
            icon={Wrench}
            tint={status.manifestInSync ? 'lime' : 'brand'}
          />
        </div>
      )}

      <ExtensionCard model={model} state={state} />
      {daemon === 'on' && (status?.pairedBrowsers === 0 || state.pairing) && <ConnectCard model={model} state={state} />}
      {!state.update && <UpdateCard model={model} state={state} />}
    </div>
  );
}

const TEXT_TINT: Record<Tint, string> = {
  brand: 'text-brand',
  lime: 'text-lime',
  amber: 'text-amber',
  danger: 'text-destructive',
  ember: 'text-ember',
  magenta: 'text-magenta',
  dim: 'text-ink-dim',
  faint: 'text-ink-faint',
};

function PowerOrb({ phase, onToggle }: { phase: DaemonPhase; onToggle: () => void }) {
  const on = phase === 'on';
  const moving = phase === 'starting' || phase === 'stopping';
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={moving}
      title={on ? 'Turn Tuhamho Brow Bridge off' : 'Turn Tuhamho Brow Bridge on'}
      aria-label={on ? 'Turn Tuhamho Brow Bridge off' : 'Turn Tuhamho Brow Bridge on'}
      className="relative size-[112px] shrink-0 rounded-full transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-offset-4"
    >
      {on && <span className="breathe absolute inset-0 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_calc(var(--glow)*0.55),transparent)_45%,transparent)]" />}
      <span
        className={cn('ring inset-3.5', (on || moving) && 'spin')}
        style={{
          background: moving
            ? 'conic-gradient(var(--brand) 0 35%, transparent 35%)'
            : on
              ? 'conic-gradient(var(--brand), color-mix(in oklch, var(--brand) 55%, white), var(--brand-deep), var(--brand))'
              : 'var(--line-strong)',
        }}
      />
      <span className="absolute inset-6.5 rounded-full border border-line-strong bg-gradient-to-b from-surface-2 to-ground-2 shadow-[0_6px_10px_rgb(0_0_0/0.35)]" />
      <Power
        className={cn('absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2', on ? 'text-brand' : 'text-ink-faint')}
        strokeWidth={3}
      />
    </button>
  );
}

function Stat({ label, value, detail, icon: Icon, tint = 'brand' }: { label: string; value: string; detail?: string; icon: LucideIcon; tint?: Tint }) {
  return (
    <div className="space-y-1.5 rounded-[14px] border border-line bg-surface/72 p-3.5">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('size-2.5', TEXT_TINT[tint])} strokeWidth={3} />
        <span className="text-[10px] font-semibold tracking-[0.08em] text-ink-faint uppercase">{label}</span>
      </div>
      <p className="truncate font-display text-[15px] font-semibold text-ink">{value}</p>
      <p className="font-mono text-[10.5px] text-ink-dim">{detail ?? ' '}</p>
    </div>
  );
}

const CODE_STEPS = 'Click Tuhamho Brow in your browser’s toolbar (the puzzle piece lists it), enter the code, and press Connect. It works once and expires in ten minutes.';

/** The code always works; once browsers connect by themselves it waits, secondary, until someone asks for one. */
export function ConnectCard({ model, state }: { model: Model; state: State }) {
  const { t } = useLanguage();
  const asking = state.busy.includes('pair');
  if (model.pairsByItself && !state.pairing) {
    return (
      <Card>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <SectionTitle title={t('Pair with a code', 'Ghép nối bằng mã')} subtitle={t('Tuhamho Brow can connect by itself. Need a code instead?', 'Tuhamho Brow có thể tự kết nối. Bạn cần mã ghép nối?')} />
          </div>
          <QuietButton icon={KeyRound} disabled={asking} onClick={() => void model.newPairingCode()}>
            {t('Get a pairing code', 'Lấy mã ghép nối')}
          </QuietButton>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="space-y-4">
        <SectionTitle title={model.pairsByItself ? t('Pair with a code', 'Ghép nối bằng mã') : t('Pair a browser', 'Ghép nối trình duyệt')} subtitle={t(CODE_STEPS, 'Nhấn Tuhamho Brow trên thanh công cụ trình duyệt, nhập mã rồi chọn Kết nối. Mã chỉ dùng một lần và hết hạn sau 10 phút.')} />
        {state.pairing ? (
          <PairingCodeView pairing={state.pairing} model={model} />
        ) : (
          <PrimaryButton icon={KeyRound} disabled={asking} onClick={() => void model.newPairingCode()}>
            {t('Get a pairing code', 'Lấy mã ghép nối')}
          </PrimaryButton>
        )}
      </div>
    </Card>
  );
}

function PairingCodeView({ pairing, model }: { pairing: PairingCode; model: Model }) {
  const { t } = useLanguage();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const left = Math.max(0, Math.floor((pairing.expiresAt - now) / 1000));
  const grouped = pairing.code.length > 4 ? `${pairing.code.slice(0, 4)}-${pairing.code.slice(4)}` : pairing.code;

  return (
    <div className="flex items-center gap-4.5">
      <div className="flex gap-1.5">
        {[...grouped].map((character, index) =>
          character === '-' ? (
            <span key={index} className="self-center font-mono text-[22px] text-ink-faint">
              –
            </span>
          ) : (
            <span
              key={index}
              className="flex h-11 w-8.5 items-center justify-center rounded-[9px] border border-brand/30 bg-ground-2 font-mono text-2xl font-bold text-brand select-text"
            >
              {character}
            </span>
          ),
        )}
      </div>
      <div className="space-y-1.5">
        <p className={cn('font-mono text-xs', left < 60 ? 'text-amber' : 'text-ink-dim')}>
          {left > 0 ? `${t('Expires in', 'Hết hạn sau')} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : t('Expired', 'Đã hết hạn')}
        </p>
        <div className="flex gap-2">
          <CopyButton value={grouped} label={t('Copy code', 'Sao chép mã')} />
          <QuietButton onClick={() => void model.newPairingCode()}>{t('New code', 'Tạo mã mới')}</QuietButton>
        </div>
      </div>
    </div>
  );
}

function ExtensionCard({ model, state }: { model: Model; state: State }) {
  const { t } = useLanguage();
  const [shown, setShown] = useState<boolean>();
  // Open from the start for someone who already loads the unpacked folder.
  const unpacked = shown ?? !!state.stamp;
  const subtitle = state.sessions.some((session) => session.connected)
    ? 'In your browser and talking to Tuhamho Brow Bridge. Store copies update themselves.'
    : {
        auto: 'Load the bundled Tuhamho Brow extension in your browser. It connects to the Bridge by itself.',
      ask: 'Load the bundled Tuhamho Brow extension, then allow it here when it asks to connect.',
      code: 'Load the bundled Tuhamho Brow extension, then enter the pairing code once.',
      }[state.pairingMode ?? 'code'];

  return (
    <Card>
      <div className="space-y-3.5">
        <SectionTitle title={t('The extension', 'Extension')} subtitle={t(subtitle, ({
          'In your browser and talking to Tuhamho Brow Bridge. Store copies update themselves.': 'Đã có trong trình duyệt và kết nối với Bridge. Extension từ cửa hàng tự cập nhật.',
          'Load the bundled Tuhamho Brow extension in your browser. It connects to the Bridge by itself.': 'Nạp extension Tuhamho Brow đi kèm vào trình duyệt. Extension sẽ tự kết nối Bridge.',
          'Load the bundled Tuhamho Brow extension, then allow it here when it asks to connect.': 'Nạp extension Tuhamho Brow đi kèm, rồi cho phép kết nối khi được hỏi.',
          'Load the bundled Tuhamho Brow extension, then enter the pairing code once.': 'Nạp extension Tuhamho Brow đi kèm, rồi nhập mã ghép nối một lần.',
        } as const)[subtitle] ?? subtitle)} />
        <div className="space-y-2">
          {model.offeredBrowsers.map((row) => (
            <BrowserExtensionRow key={row.id} row={row} model={model} state={state} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShown(!unpacked)}
          className="flex items-center gap-1.5 text-xs font-medium text-ink-dim transition hover:text-ink"
        >
          {unpacked ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          {t('Manual extension setup', 'Hướng dẫn cài extension thủ công')}
        </button>
        {unpacked && (
          <div className="space-y-3 border-l border-line pl-5">
            <p className="text-xs text-ink-dim">
              {t('Tuhamho Brow includes its own extension build. Load this local copy in Chrome, Edge, or Brave.', 'Tuhamho Brow có extension riêng. Hãy nạp bản cục bộ này vào Chrome, Edge hoặc Brave.')}
            </p>
            {state.info && <PathRow path={state.info.paths.extensionDir} model={model} info={state.info} />}
            <div className="space-y-2">
              <Step number={1}>{t('Open chrome://extensions and turn on Developer mode.', 'Mở chrome://extensions và bật Chế độ dành cho nhà phát triển.')}</Step>
              <Step number={2}>{t('Press “Load unpacked”, then paste the folder above into the picker’s address bar.', 'Chọn “Load unpacked”, rồi dán đường dẫn thư mục ở trên vào thanh địa chỉ của hộp thoại.')}</Step>
              <Step number={3}>{model.pairsByItself ? t('It connects by itself, or with a pairing code from the Browsers tab.', 'Extension sẽ tự kết nối hoặc dùng mã ghép nối trong mục Trình duyệt.') : t('Click Tuhamho Brow in the toolbar and enter a pairing code.', 'Nhấn Tuhamho Brow trên thanh công cụ và nhập mã ghép nối.')}</Step>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {state.browsers
                .filter((browser) => !/firefox/i.test(browser.name))
                .slice(0, 3)
                .map((browser) => (
                  <QuietButton key={browser.path} icon={SquareArrowOutUpRight} onClick={() => void model.openExtensionsPage(browser)}>
                    {t('Extensions in', 'Extension trong')} {browser.name}
                  </QuietButton>
                ))}
              <div className="flex-1" />
              <QuietButton icon={FileDown} disabled={state.busy.includes('extension')} onClick={() => void model.reinstallExtension()}>
                {state.stamp ? t('Write it again', 'Ghi lại extension') : t('Write it', 'Tạo extension')}
              </QuietButton>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function BrowserExtensionRow({ row, model, state }: { row: BrowserRow; model: Model; state: State }) {
  const { t } = useLanguage();
  const copy = row.sessions.find((session) => session.connected) ?? row.sessions[0];
  const stale = copy?.source === 'unpacked' && !!state.stamp && copy.extensionVersion !== state.stamp.version;
  const where = copy
      ? `${t(SOURCE_LABEL[copy.source ?? 'unpacked'], 'Bản cục bộ')} · v${copy.extensionVersion}`
    : state.stamp
      ? t('Tuhamho Brow · local extension ready to load', 'Tuhamho Brow · extension cục bộ, sẵn sàng nạp')
      : t('Tuhamho Brow · local extension', 'Tuhamho Brow · extension cục bộ');

  return (
    <div className="flex items-center gap-3 rounded-xl bg-ground-2 px-3 py-2.5">
      <GlowDot tint={copy?.connected ? 'lime' : 'faint'} pulsing={!!copy?.connected} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{row.label}</p>
        <p className="truncate text-[11.5px] text-ink-dim">{where}</p>
      </div>
      {stale && <Pill text="Reload needed" tint="amber" icon={RefreshCw} />}
      {copy ? (
        <Pill text={copy.connected ? t('Connected', 'Đã kết nối') : t('Not connected', 'Chưa kết nối')} tint={copy.connected ? 'lime' : 'dim'} />
      ) : (
        <QuietButton icon={Puzzle} tint="brand" disabled={state.busy.includes(`add:${row.id}`)} onClick={() => void model.addExtension(row)}>
          {t(`Load in ${row.label}`, `Nạp vào ${row.label}`)}
        </QuietButton>
      )}
    </div>
  );
}

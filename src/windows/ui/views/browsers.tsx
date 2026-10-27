import { useState } from 'react';
import { Globe, PencilLine, RotateCcw } from 'lucide-react';

import { formatWhen } from '@/lib/format-when';
import { SOURCE_LABEL } from '@/lib/stores';
import { useLanguage } from '../language';
import { Card, ConfirmDialog, EmptyState, GlowDot, OfflineHint, Pill, QuietButton, SectionTitle, TextField } from '../components';
import { sessionName, type Model, type State } from '../model';
import type { BlockedBrowser, PairedBy, PairingMode, SessionSummary } from '../backend';
import { ConnectCard } from './overview';

const extensionId = (origin: string) => origin.replace(/^[a-z-]+-extension:\/\//, '').replace(/\/$/, '');
const ago = (iso: string) => formatWhen(Date.parse(iso));

const PAIRED_BY: Record<PairedBy, string> = { auto: 'Paired by itself', approved: 'Allowed', code: 'Paired with a code' };

const NONE_PAIRED: Record<PairingMode, string> = {
  auto: 'Add the extension from the Overview tab, and it connects by itself.',
  ask: 'Add the extension from the Overview tab, then allow it here when it asks to connect.',
  code: 'Add the extension from the Overview tab, or get a code above and enter it in the Tuhamho Brow side panel.',
};

type Asking = { kind: 'unpair' | 'rename'; session: SessionSummary } | { kind: 'unpair-all' };

export function BrowsersView({ model, state }: { model: Model; state: State }) {
  const { t } = useLanguage();
  const [asking, setAsking] = useState<Asking>();
  if (state.daemon !== 'on') return <OfflineHint what="Paired browsers" model={model} daemonOff={state.daemon === 'off'} />;
  const close = () => setAsking(undefined);

  return (
    <div className="space-y-4.5">
      <ConnectCard model={model} state={state} />
      <Card>
        <div className="space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <SectionTitle
                title={t('Paired browsers', 'Trình duyệt đã ghép nối')}
                subtitle={t('Each one holds a key of its own. Unpairing drops the key, disconnects it at once, and keeps it out until you reconnect it.', 'Mỗi trình duyệt có khóa riêng. Hủy ghép nối sẽ ngắt kết nối ngay và chặn đến khi bạn kết nối lại.')}
              />
            </div>
            {state.sessions.length > 1 && (
              <QuietButton tint="danger" onClick={() => setAsking({ kind: 'unpair-all' })}>
                {t('Unpair all', 'Hủy ghép nối tất cả')}
              </QuietButton>
            )}
          </div>
          {state.sessions.length === 0 ? (
            <EmptyState icon={Globe} title={t('No browser is paired', 'Chưa có trình duyệt nào được ghép nối')} detail={t(NONE_PAIRED[state.pairingMode ?? 'code'], ({
              auto: 'Nạp extension Tuhamho Brow từ mục Tổng quan để tự kết nối.',
              ask: 'Nạp extension Tuhamho Brow từ mục Tổng quan, rồi cho phép kết nối khi được hỏi.',
              code: 'Nạp extension Tuhamho Brow từ mục Tổng quan hoặc lấy mã ghép nối bên trên.',
            } as const)[state.pairingMode ?? 'code'])} />
          ) : (
            state.sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                busy={state.busy.includes('revoke') || state.busy.includes(`label:${session.id}`)}
                onRename={state.status?.pairing ? () => setAsking({ kind: 'rename', session }) : undefined}
                onUnpair={() => setAsking({ kind: 'unpair', session })}
              />
            ))
          )}
        </div>
      </Card>
      {state.blocked.length > 0 && <KeptOut model={model} state={state} />}
      {asking?.kind === 'unpair-all' && (
        <ConfirmDialog
          title="Unpair every browser?"
          message="They won’t reconnect by themselves until you reconnect them."
          action="Unpair all"
          onCancel={close}
          onConfirm={() => {
            close();
            void model.revoke();
          }}
        />
      )}
      {asking?.kind === 'unpair' && (
        <ConfirmDialog
          title={`Unpair ${sessionName(asking.session)}?`}
          message="It won’t reconnect by itself until you reconnect it."
          action="Unpair"
          onCancel={close}
          onConfirm={() => {
            close();
            void model.revoke(asking.session);
          }}
        />
      )}
      {asking?.kind === 'rename' && <RenameDialog session={asking.session} model={model} onClose={close} />}
    </div>
  );
}

function SessionRow({ session, busy, onRename, onUnpair }: { session: SessionSummary; busy: boolean; onRename?: () => void; onUnpair: () => void }) {
  const { t } = useLanguage();
  const name = session.label ?? session.browser;
  const paired = `${PAIRED_BY[session.pairedBy ?? 'code'] ?? 'Paired'} ${ago(session.pairedAt)}`;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-ground-2 p-3">
      <GlowDot tint={session.connected ? 'lime' : 'faint'} pulsing={session.connected} />
      <div className="min-w-0 flex-1 space-y-0.75">
        {name && <p className="truncate text-[13px] font-medium text-ink">{name}</p>}
        <p className={name ? 'truncate font-mono text-xs text-ink-dim select-text' : 'truncate font-mono text-xs text-ink select-text'}>
          {session.label && session.browser && session.label !== session.browser && <span className="font-sans">{session.browser} · </span>}
          {extensionId(session.origin)}
        </p>
        <p className="text-[11.5px] text-ink-dim">
          {t(SOURCE_LABEL[session.source ?? 'unpacked'], 'Bản cục bộ')} · v{session.extensionVersion} · {paired} · {t('seen', 'hoạt động')} {ago(session.lastSeenAt)}
        </p>
      </div>
      <Pill text={session.connected ? t('Connected', 'Đã kết nối') : t('Away', 'Ngoại tuyến')} tint={session.connected ? 'lime' : 'dim'} />
      {onRename && (
        <QuietButton icon={PencilLine} disabled={busy} onClick={onRename}>
          {t('Rename', 'Đổi tên')}
        </QuietButton>
      )}
      <QuietButton tint="danger" disabled={busy} onClick={onUnpair}>
        {t('Unpair', 'Hủy ghép nối')}
      </QuietButton>
    </div>
  );
}

function RenameDialog({ session, model, onClose }: { session: SessionSummary; model: Model; onClose: () => void }) {
  const { t } = useLanguage();
  const [label, setLabel] = useState(session.label ?? session.browser ?? '');
  return (
    <ConfirmDialog
      title={`Rename ${sessionName(session)}`}
      message={t('The name this computer shows for it, to tell two profiles of one browser apart. Leave it empty to use the browser’s own name.', 'Tên hiển thị trên máy này để phân biệt các hồ sơ trình duyệt. Để trống để dùng tên mặc định.')}
      action={t('Save', 'Lưu')}
      tint="brand"
      onCancel={onClose}
      onConfirm={() => {
        onClose();
        void model.rename(session, label);
      }}
    >
      <TextField label={t('Name', 'Tên')} value={label} placeholder={session.browser} maxLength={40} onChange={setLabel} />
    </ConfirmDialog>
  );
}

function KeptOut({ model, state }: { model: Model; state: State }) {
  const { t } = useLanguage();
  return (
    <Card>
      <div className="space-y-3.5">
        <SectionTitle title={t('Kept out', 'Đã chặn')} subtitle={t('Browsers you unpaired or denied. None of them connects by itself until you reconnect it.', 'Trình duyệt bạn đã hủy ghép nối hoặc từ chối. Chúng sẽ không tự kết nối lại cho đến khi bạn cho phép.')} />
        {state.blocked.map((browser) => (
          <KeptOutRow key={browser.installId} browser={browser} model={model} busy={state.busy.includes(`reconnect:${browser.installId}`)} />
        ))}
      </div>
    </Card>
  );
}

function KeptOutRow({ browser, model, busy }: { browser: BlockedBrowser; model: Model; busy: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-3 rounded-xl bg-ground-2 p-3">
      <GlowDot tint="faint" />
      <div className="min-w-0 flex-1 space-y-0.75">
        <p className="truncate text-[13px] font-medium text-ink">{browser.browser ?? 'A browser'}</p>
        <p className="text-[11.5px] text-ink-dim">
          {t(browser.reason === 'revoked' ? 'Unpaired' : 'Denied', browser.reason === 'revoked' ? 'Đã hủy ghép nối' : 'Đã từ chối')} {ago(browser.at)} · <span className="font-mono select-text">{browser.installId.slice(0, 8)}</span>
        </p>
      </div>
      <QuietButton icon={RotateCcw} tint="brand" disabled={busy} onClick={() => void model.reconnect(browser)}>
        {t('Reconnect', 'Kết nối lại')}
      </QuietButton>
    </div>
  );
}

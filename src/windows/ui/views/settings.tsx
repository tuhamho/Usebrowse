import { useState } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';

import { GuardrailPolicy } from '@/extension/components/guardrail-policy';
import { ThemePicker } from '@/extension/components/theme-picker';
import { Switch } from '@/extension/components/ui/switch';
import { DEFAULT_THEME } from '@/lib/settings/theme';
import { cn } from '@/lib/utils';
import { useLanguage } from '../language';
import { Card, ConfirmDialog, CopyButton, OfflineHint, PathRow, PrimaryButton, QuietButton, SectionTitle, Segmented, Spinner } from '../components';
import { short, type Appearance, type Model, type State } from '../model';
import type { PairingMode } from '../backend';
import { UpdateCard } from './update-card';

export function SettingsView({ model, state }: { model: Model; state: State }) {
  const { t } = useLanguage();
  const [confirming, setConfirming] = useState(false);
  const [keepSkills, setKeepSkills] = useState(true);
  const info = state.info;
  const mcpCommand = `claude mcp add browsentic -- ${info?.paths.mcpShim ?? 'browsentic-mcp'}`;
  const link = state.commandLink;

  return (
    <div className="space-y-4.5">
      <UpdateCard model={model} state={state} />

      <Card>
        <div className="space-y-3.5">
          <SectionTitle title={t('Appearance', 'Giao diện')} />
          <Segmented<Appearance>
            options={[
              { value: 'system', label: t('System', 'Theo hệ thống') },
              { value: 'light', label: t('Light', 'Sáng') },
              { value: 'dark', label: t('Dark', 'Tối') },
            ]}
            value={state.appearance}
            onSelect={(appearance) => model.setAppearance(appearance)}
          />
          <div className="border-t border-line" />
          <SwitchRow
            title={t('Turn Browsentic Bridge on when the app opens', 'Tự bật Bridge khi mở ứng dụng')}
            subtitle={t('It keeps running after the window closes, so the side panel and MCP clients still work.', 'Bridge tiếp tục chạy sau khi đóng cửa sổ để bảng bên và MCP vẫn hoạt động.')}
            checked={state.startDaemonOnLaunch}
            onChange={(on) => model.setStartDaemonOnLaunch(on)}
          />
        </div>
      </Card>

      <PairingSettings model={model} state={state} />

      <BrowserSettings model={model} state={state} />

      <Card>
        <div className="space-y-3">
          <SwitchRow
            title={t('“browsentic” in your terminal', 'Dùng lệnh “browsentic” trong Terminal')}
            subtitle={
              link?.linkedIn
                ? `On your PATH, in ${short(link.linkedIn, info)}. Everything this window does, the command does too. Terminals opened from now on have it.`
                : t('Adds its folder to your user PATH. No administrator, and only terminals opened afterwards see it.', 'Thêm thư mục lệnh vào PATH của bạn. Không cần quyền quản trị; chỉ Terminal mở sau đó mới nhận lệnh.')
            }
            checked={!!link?.linkedIn}
            onChange={(on) => void model.setCommandLink(on)}
          />
          {link?.foreign && (
            <p className="flex gap-1.5 text-[11.5px] text-amber">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              Another browsentic is already on your PATH at {link.foreign}. Remove it with “npm rm -g browsentic” so the two cannot disagree.
            </p>
          )}
          {info && <PathRow path={info.paths.shim} model={model} info={info} />}
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <SectionTitle
            title={t('Optional: use it from an MCP client', 'Tùy chọn: dùng với MCP client')}
            subtitle={t('The same browser tools, handed to Claude Code or any other MCP client. The side panel does not need this.', 'Cung cấp các công cụ trình duyệt cho Claude Code hoặc MCP client khác. Bảng bên không cần mục này.')}
          />
          <div className="flex items-center gap-2 rounded-[10px] border border-line bg-ground-2 py-1.5 pr-1.5 pl-3">
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink select-text">{mcpCommand}</span>
            <CopyButton value={mcpCommand} />
          </div>
          {state.lock && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-dim">{t('Control token', 'Mã điều khiển')}</span>
              <span className="font-mono text-[11px] text-ink-faint">{'•'.repeat(24)}</span>
              <div className="flex-1" />
              <CopyButton value={state.lock.token} label={t('Copy token', 'Sao chép mã')} />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <SectionTitle
              title={t('Uninstall', 'Gỡ cài đặt')}
              subtitle={t('Stops Browsentic Bridge, unpairs every browser, and removes the command, the unpacked extension, keys, approvals and logs.', 'Dừng Bridge, hủy ghép nối mọi trình duyệt và xóa lệnh, extension, khóa, quyền truy cập và nhật ký.')}
            />
          </div>
          <QuietButton tint="danger" onClick={() => setConfirming(true)}>
            {t('Uninstall…', 'Gỡ cài đặt…')}
          </QuietButton>
        </div>
      </Card>

      {confirming && (
        <ConfirmDialog
          title={t('Uninstall Tuhamho Brow?', 'Gỡ Tuhamho Brow?')}
          message={
            'This stops Browsentic Bridge, unpairs every browser, and removes %USERPROFILE%\\.browsentic and %USERPROFILE%\\browsentic: the command, the unpacked extension, keys, approvals and logs.\n\nRemove Browsentic from each browser first: right-click its toolbar icon and choose Remove. Afterwards, uninstall the app itself in Settings › Apps › Installed apps.'
          }
          action={t('Uninstall', 'Gỡ cài đặt')}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void model.uninstall(keepSkills);
          }}
        >
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input type="checkbox" checked={keepSkills} onChange={(event) => setKeepSkills(event.target.checked)} className="accent-[var(--brand)]" />
            {t('Keep my skills and site maps', 'Giữ lại kỹ năng và sơ đồ trang web')}
          </label>
        </ConfirmDialog>
      )}
    </div>
  );
}

function SwitchRow({ title, subtitle, checked, onChange }: { title: string; subtitle: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <SectionTitle title={title} subtitle={subtitle} />
      </div>
      <Switch checked={checked} label={title} onChange={onChange} />
    </div>
  );
}

const PAIRING: { mode: PairingMode; title: string; detail: string }[] = [
  { mode: 'auto', title: 'Automatic', detail: 'A browser with Browsentic connects by itself.' },
  { mode: 'ask', title: 'Ask me', detail: 'You allow each new browser here first.' },
  { mode: 'code', title: 'Code only', detail: 'A browser connects only with a code you type into it.' },
];

/** How a browser with the extension gets in, kept by Browsentic Bridge in config.json; `browsentic pairing` changes the same setting. */
function PairingSettings({ model, state }: { model: Model; state: State }) {
  const { t } = useLanguage();
  if (state.daemon !== 'on') return null;
  return (
    <Card>
      <div className="space-y-3.5">
        <SectionTitle title={t('Pairing', 'Ghép nối')} subtitle={t('How a browser with the extension connects to Browsentic Bridge. Browsers already paired stay paired.', 'Cách trình duyệt có extension kết nối với Bridge. Các trình duyệt đã ghép nối vẫn được giữ nguyên.')} />
        {state.pairingMode ? (
          <div role="radiogroup" aria-label="Pairing" className="grid grid-cols-3 gap-2">
            {PAIRING.map(({ mode, title, detail }) => {
              const chosen = state.pairingMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  disabled={state.busy.includes('pairing')}
                  onClick={() => void model.setPairingMode(mode)}
                  className={cn(
                    'space-y-1 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:opacity-60',
                    chosen ? 'border-brand/50 bg-brand/10' : 'border-line bg-ground-2 hover:border-line-strong',
                  )}
                >
                  <span className={cn('block text-[13px] font-semibold', chosen ? 'text-brand' : 'text-ink')}>{t(title, ({ Automatic: 'Tự động', 'Ask me': 'Hỏi trước', 'Code only': 'Chỉ dùng mã' } as const)[title] ?? title)}</span>
                  <span className="block text-[11.5px] leading-snug text-ink-dim">{t(detail, ({
                    'A browser with Browsentic connects by itself.': 'Trình duyệt có Tuhamho Brow sẽ tự kết nối.',
                    'You allow each new browser here first.': 'Bạn cần cho phép từng trình duyệt mới tại đây.',
                    'A browser connects only with a code you type into it.': 'Trình duyệt chỉ kết nối khi bạn nhập mã ghép nối.',
                  } as const)[detail] ?? detail)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3.5">
            <p className="min-w-0 flex-1 text-xs text-ink-dim">
              This Browsentic Bridge started before browsers could connect by themselves, so it pairs only with a code. Restart it to choose.
            </p>
            <PrimaryButton onClick={() => void model.restartDaemon()}>{t('Restart it', 'Khởi động lại')}</PrimaryButton>
          </div>
        )}
      </div>
    </Card>
  );
}

/** The settings every paired browser shares, kept by the daemon in config.json. The extension's own settings page edits the same values. */
function BrowserSettings({ model, state }: { model: Model; state: State }) {
  const { t } = useLanguage();
  if (state.daemon !== 'on') return <OfflineHint what="The browser theme and the guardrails" model={model} daemonOff={state.daemon === 'off'} />;
  if (state.preferencesUnsupported) {
    return (
      <Card>
        <div className="flex items-center gap-3.5">
          <RefreshCw className="size-5 shrink-0 text-amber" strokeWidth={2.5} />
          <div className="min-w-0 flex-1">
            <SectionTitle
              title={t('Browsentic Bridge predates this app', 'Bridge cần được cập nhật')}
              subtitle={t('It is still running from before the last update, so it cannot share the browser theme or the guardrails yet.', 'Bridge đang chạy phiên bản cũ nên chưa đồng bộ được giao diện trình duyệt và quy tắc an toàn.')}
            />
          </div>
          <PrimaryButton onClick={() => void model.restartDaemon()}>{t('Restart it', 'Khởi động lại')}</PrimaryButton>
        </div>
      </Card>
    );
  }
  const preferences = state.preferences;
  if (!preferences) {
    return (
      <Card>
        <div className="flex justify-center">
          <Spinner />
        </div>
      </Card>
    );
  }
  const guardrailBusy = state.busy.find((key) => key.startsWith('guardrail:'))?.slice('guardrail:'.length) ?? null;

  return (
    <>
      <Card>
        <div className="space-y-3.5">
          <SectionTitle
            title={t('Browser theme', 'Giao diện trình duyệt')}
            subtitle={t('How the side panel and the extension’s settings page look in every paired browser. This window keeps its own appearance.', 'Giao diện bảng bên và trang cài đặt extension trên các trình duyệt đã ghép nối. Cửa sổ ứng dụng có giao diện riêng.')}
          />
          <ThemePicker theme={preferences.theme ?? DEFAULT_THEME} onSelect={(theme) => void model.setBrowserTheme(theme)} />
        </div>
      </Card>
      <Card>
        <div className="space-y-4">
          <SectionTitle
            title={t('Guardrails', 'Quy tắc an toàn')}
            subtitle={t('What the agent may do without asking you first. A run takes its policy when it starts, and every paired browser follows the same rules.', 'Các thao tác agent được phép thực hiện mà không cần hỏi. Quy tắc áp dụng từ lúc bắt đầu và dùng chung cho mọi trình duyệt.')}
          />
          <GuardrailPolicy
            settings={preferences.guardrails}
            busy={guardrailBusy}
            error={null}
            onWrite={(setting, value) => void model.setGuardrail(setting, value)}
            onReload={() => void model.loadPreferences()}
          />
        </div>
      </Card>
    </>
  );
}

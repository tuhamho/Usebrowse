import { AGENTS, activeRunner, type AgentState } from '@/lib/agents/catalog';

const REPOSITORY = 'https://github.com/tuhamho/Usebrowse';

export const LINKS = {
  author: 'https://github.com/tuhamho',
  repository: REPOSITORY,
  site: REPOSITORY,
  guide: `${REPOSITORY}#readme`,
  pairing: `${REPOSITORY}#readme`,
  installGuide: `${REPOSITORY}#readme`,
  troubleshooting: `${REPOSITORY}/issues`,
  windowsApp: `${REPOSITORY}#readme`,
  changelog: `${REPOSITORY}/releases`,
  feature: `${REPOSITORY}/issues/new?template=capability.yml`,
} as const;

export const AUTHOR = 'tuhamho';

export const STAR_ASK =
  'Tuhamho Brow is free and open source. Star the project on GitHub to follow its development.';

export interface VersionRow {
  label: string;
  value: string;
}

export const describeVersions = (rows: readonly VersionRow[]): string =>
  rows.map(({ label, value }) => `${label} ${value}`).join(' · ');

const RELEASE = /\d+(?:\.\d+)+(?:[-+][\w.]+)?/;

export function describeAgent(state: AgentState | undefined): string | undefined {
  const runner = activeRunner(state);
  if (!runner) return undefined;
  const release = runner.version && (runner.version.match(RELEASE)?.[0] ?? runner.version);
  return [AGENTS[runner.kind]?.label ?? runner.kind, release].filter(Boolean).join(' ');
}

export function bugReportUrl({ environment, agent }: { environment: string; agent?: string }): string {
  const fields = new URLSearchParams({ template: 'bug_report.yml', environment, ...(agent ? { agent } : {}) });
  return `${REPOSITORY}/issues/new?${fields}`;
}

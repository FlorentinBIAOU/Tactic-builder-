import { useTranslation } from 'react-i18next';
import type { AgentReportRecord } from '@/lib/types';

/** The content of one agent report: findings, sections, lessons. */
export function ReportBody({ report }: { report: AgentReportRecord['report'] }) {
  const { t } = useTranslation('agents');
  const findings = report.findings?.filter(Boolean) ?? [];
  const sections = report.sections ?? [];
  const lessons = report.lessons ?? [];

  if (!findings.length && !sections.length && !lessons.length) {
    return <p className="text-base text-muted">{t('report.empty')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {findings.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">{t('report.findings')}</h3>
          <ol className="flex flex-col gap-2">
            {findings.map((f, i) => (
              <li key={i} className="flex gap-3 text-base leading-relaxed">
                <span aria-hidden className="tabular mt-0.5 w-5 shrink-0 text-right text-sm text-muted">
                  {i + 1}.
                </span>
                <span className="min-w-0 break-words">{f}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {sections.map((s, i) => (
        <section key={i} className="flex flex-col gap-1.5">
          <h3 className="text-base font-semibold">{s.title}</h3>
          <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground/90">{s.content}</p>
        </section>
      ))}

      {lessons.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">{t('report.lessons')}</h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {lessons.map((l, i) => (
              <li key={i} className="flex flex-col gap-0.5 px-3 py-2.5">
                <span className="font-medium">{l.name}</span>
                {l.rationale ? <span className="text-sm text-muted">{l.rationale}</span> : null}
                {l.id ? <span className="text-xs text-muted">{t('report.lessonId', { id: l.id })}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

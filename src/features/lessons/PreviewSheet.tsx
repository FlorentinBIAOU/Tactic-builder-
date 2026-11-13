import { useTranslation } from 'react-i18next';
import * as D from '@radix-ui/react-dialog';
import { Pencil } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { Button } from '@/components/ui/button';
import { SheetContent } from '@/components/ui/dialog';
import { StatusBadge, TranslationMarks } from './LessonBadges';
import { LessonPreview } from './LessonPreview';
import { useMediaQuery } from './useMediaQuery';

/** "As in the app" preview of a lesson, opened from the list. */
export function PreviewSheet() {
  const { t } = useTranslation('lessons');
  const { t: tc } = useTranslation();
  const lesson = useCorpus((s) => s.previewLesson);
  const close = useCorpus((s) => s.closePreview);
  const openEditor = useCorpus((s) => s.openEditor);
  const tracks = useCorpus((s) => s.tracks);
  const phone = useMediaQuery('(max-width: 639px)');
  const track = lesson ? (tracks.find((tr) => tr.id === lesson.trackId) ?? null) : null;

  return (
    <D.Root open={!!lesson} onOpenChange={(o) => !o && close()}>
      {lesson ? (
        <SheetContent
          title={lesson.name || t('list.untitled')}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusBadge status={lesson.status} />
              <span>{track ? track.nameFr : t('list.noModule')}</span>
              <TranslationMarks lesson={lesson} />
            </span>
          }
          width="sm:max-w-xl"
          closeLabel={tc('actions.close')}
          className="[&>div:nth-child(2)]:bg-background/40"
          footer={
            <Button
              onClick={() => {
                close();
                openEditor(lesson);
              }}
            >
              <Pencil aria-hidden />
              {t('preview.edit')}
            </Button>
          }
        >
          <LessonPreview key={lesson.id} lesson={lesson} track={track} framed={!phone} />
        </SheetContent>
      ) : null}
    </D.Root>
  );
}

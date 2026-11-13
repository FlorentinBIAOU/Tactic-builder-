import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CampaignsTab } from './CampaignsTab';
import { CopyTab } from './CopyTab';

type Tab = 'campaigns' | 'copy';

/** /marketing — campaign performance and AI copywriting. */
export default function MarketingPage() {
  const { t } = useTranslation('marketing');
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'copy' ? 'copy' : 'campaigns';
  const [createSignal, setCreateSignal] = useState(0);

  const setTab = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === 'copy') next.set('tab', 'copy');
    else next.delete('tab');
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          tab === 'campaigns' ? (
            <Button variant="primary" onClick={() => setCreateSignal((n) => n + 1)}>
              <Plus aria-hidden />
              {t('newCampaign')}
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="campaigns">{t('tabs.campaigns')}</TabsTrigger>
          <TabsTrigger value="copy">{t('tabs.copy')}</TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns" forceMount className="focus-visible:outline-none data-[state=inactive]:hidden">
          <CampaignsTab createSignal={createSignal} />
        </TabsContent>
        <TabsContent value="copy" forceMount className="focus-visible:outline-none data-[state=inactive]:hidden">
          <CopyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

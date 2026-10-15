import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/disclosure';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { PageHeader, Panel, QueryError } from '../components/page';
import { DeliveryTab } from '../components/settings/delivery';
import { EmailsTab } from '../components/settings/emails';
import { StoreSettingsForm } from '../components/settings/store-form';
import { ak, useCan, useUrlState } from '../lib';
import type { SettingsResponse } from '../types';

const TABS = [
  { value: 'store', label: 'Магазин' },
  { value: 'delivery', label: 'Доставка' },
  { value: 'emails', label: 'Очередь писем' },
];

function StoreTab({ canWrite }: { canWrite: boolean }) {
  const q = useQuery({ queryKey: ak.settings, queryFn: () => api.get<SettingsResponse>('/admin/settings'), staleTime: 0 });
  if (q.isLoading)
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  if (q.isError || !q.data)
    return (
      <Panel>
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      </Panel>
    );
  return <StoreSettingsForm key={String((q.data.settings as { updatedAt?: string }).updatedAt)} data={q.data} canWrite={canWrite} />;
}

export default function SettingsPage() {
  const can = useCan();
  const canWrite = can('settings.write');
  const { get, set } = useUrlState();
  const tab = TABS.some((t) => t.value === get('tab')) ? get('tab') : 'store';

  return (
    <>
      <Seo title="Настройки" noindex />
      <PageHeader title="Настройки" description={canWrite ? undefined : 'Режим просмотра: у вас нет права изменять настройки'} />
      <Tabs value={tab} onValueChange={(v) => set({ tab: v === 'store' ? null : v, emailStatus: null })}>
        <TabsList className="mb-6">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="store" className="focus-visible:outline-none">
          <StoreTab canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="delivery" className="focus-visible:outline-none">
          <DeliveryTab canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="emails" className="focus-visible:outline-none">
          <EmailsTab canWrite={canWrite} />
        </TabsContent>
      </Tabs>
    </>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CornerDownRight, FolderTree, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, Tr } from '@/components/ui/data';
import { useConfirm } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { ActiveBadge } from '../components/badges';
import { BrandDialog, CategorySheet } from '../components/category-dialog';
import { PageHeader, Panel, QueryError, TableSkeleton } from '../components/page';
import { ak, useCan } from '../lib';
import type { AdminBrand, AdminCategory } from '../types';

export default function CategoriesPage() {
  const can = useCan();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const canWrite = can('categories.write');
  const cats = useQuery({ queryKey: ak.categories, queryFn: () => api.get<AdminCategory[]>('/admin/categories') });
  const brands = useQuery({ queryKey: ak.brands, queryFn: () => api.get<AdminBrand[]>('/admin/brands') });

  const [sheet, setSheet] = useState<{ open: boolean; category: AdminCategory | null; parentId?: string | null }>({ open: false, category: null });
  const [brandDialog, setBrandDialog] = useState<{ open: boolean; brand: AdminBrand | null }>({ open: false, brand: null });

  const removeCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      toast.success('Категория удалена');
      qc.invalidateQueries({ queryKey: ak.categories });
      qc.invalidateQueries({ queryKey: ak.references });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removeBrand = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/brands/${id}`),
    onSuccess: () => {
      toast.success('Бренд удалён');
      qc.invalidateQueries({ queryKey: ak.brands });
      qc.invalidateQueries({ queryKey: ak.references });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onDeleteCategory = async (c: AdminCategory) => {
    if (c._count.products > 0) {
      toast.error(`В категории ${c._count.products} товаров — сначала перенесите их`);
      return;
    }
    const ok = await confirm({
      title: `Удалить категорию «${c.name}»?`,
      description: c._count.children ? 'Подкатегории станут категориями верхнего уровня.' : 'Действие нельзя отменить.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok) removeCategory.mutate(c.id);
  };
  const onDeleteBrand = async (b: AdminBrand) => {
    const ok = await confirm({
      title: `Удалить бренд «${b.name}»?`,
      description: b._count.products ? `У ${b._count.products} товаров бренд будет снят.` : 'Действие нельзя отменить.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok) removeBrand.mutate(b.id);
  };

  const all = cats.data ?? [];
  const roots = all.filter((c) => !c.parentId || !all.some((p) => p.id === c.parentId));
  const rows = roots.flatMap((r) => [{ c: r, depth: 0 }, ...all.filter((c) => c.parentId === r.id).map((c) => ({ c, depth: 1 }))]);

  const categoryRow = ({ c, depth }: { c: AdminCategory; depth: number }) => (
    <Tr key={c.id}>
      <Td>
        <div className={cn('flex items-center gap-2', depth && 'pl-6')}>
          {depth > 0 && <CornerDownRight className="size-3.5 text-stone" aria-hidden />}
          {c.imageUrl && <img src={c.imageUrl} alt="" className="size-8 shrink-0 object-cover" loading="lazy" />}
          <div>
            <p className={cn(depth === 0 && 'font-medium')}>{c.name}</p>
            <p className="font-mono text-2xs text-stone">/{c.slug}</p>
          </div>
        </div>
      </Td>
      <Td className="text-right tabular-nums">{c._count.products}</Td>
      <Td className="text-right tabular-nums text-stone">{c.sortOrder}</Td>
      <Td>
        <ActiveBadge active={c.isActive} />
      </Td>
      <Td>
        {canWrite && (
          <div className="flex justify-end gap-1">
            {depth === 0 && (
              <Button variant="ghost" size="icon-sm" onClick={() => setSheet({ open: true, category: null, parentId: c.id })} aria-label={`Добавить подкатегорию в «${c.name}»`} title="Добавить подкатегорию">
                <Plus />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={() => setSheet({ open: true, category: c })} aria-label={`Редактировать «${c.name}»`}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => onDeleteCategory(c)} aria-label={`Удалить «${c.name}»`}>
              <Trash2 />
            </Button>
          </div>
        )}
      </Td>
    </Tr>
  );

  return (
    <>
      <Seo title="Категории и бренды" noindex />
      <PageHeader
        title="Категории и бренды"
        description="Два уровня вложенности: раздел и подкатегория"
        actions={
          canWrite && (
            <Button onClick={() => setSheet({ open: true, category: null })}>
              <Plus /> Категория
            </Button>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Категории" bodyClassName="p-0">
          {cats.isLoading ? (
            <TableSkeleton cols={4} />
          ) : cats.isError ? (
            <QueryError error={cats.error} onRetry={() => cats.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState icon={<FolderTree />} title="Категорий нет" description="Создайте первую категорию каталога." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Название</Th>
                  <Th className="text-right">Товары</Th>
                  <Th className="text-right">Порядок</Th>
                  <Th>Статус</Th>
                  <Th>
                    <span className="sr-only">Действия</span>
                  </Th>
                </tr>
              </thead>
              <tbody>{rows.map(categoryRow)}</tbody>
            </Table>
          )}
        </Panel>

        <Panel
          title="Бренды"
          bodyClassName="p-0"
          actions={
            canWrite && (
              <Button size="sm" variant="outline" onClick={() => setBrandDialog({ open: true, brand: null })}>
                <Plus /> Бренд
              </Button>
            )
          }
        >
          {brands.isLoading ? (
            <TableSkeleton rows={5} cols={2} />
          ) : brands.isError ? (
            <QueryError error={brands.error} onRetry={() => brands.refetch()} />
          ) : !brands.data?.length ? (
            <EmptyState icon={<Tag />} title="Брендов нет" />
          ) : (
            <ul className="divide-y divide-line">
              {brands.data.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-2xs text-stone">
                      <span className="font-mono">{b.slug}</span> · товаров: {b._count.products}
                    </p>
                  </div>
                  {canWrite && (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setBrandDialog({ open: true, brand: b })} aria-label={`Редактировать бренд «${b.name}»`}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => onDeleteBrand(b)} aria-label={`Удалить бренд «${b.name}»`}>
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {canWrite && (
        <>
          <CategorySheet
            open={sheet.open}
            onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
            category={sheet.category}
            defaultParentId={sheet.parentId}
            categories={all}
          />
          <BrandDialog open={brandDialog.open} onOpenChange={(open) => setBrandDialog((s) => ({ ...s, open }))} brand={brandDialog.brand} />
        </>
      )}
    </>
  );
}

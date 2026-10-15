import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import type { ProductInput, ProductInputParsed } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/form';
import { Spinner } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { cn, imageUrl } from '@/lib/utils';
import type { RefColor } from '../types';

type Form = UseFormReturn<ProductInput, unknown, ProductInputParsed>;

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES = 12;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

interface UploadItem {
  key: string;
  name: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function ImageManager({ form, colors, disabled }: { form: Form; colors: RefColor[]; disabled?: boolean }) {
  const { control, register, getValues, setValue } = form;
  const { fields, append, remove, move } = useFieldArray({ control, name: 'images', keyName: 'fieldKey' });
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const uploading = queue.some((q) => q.status === 'uploading' || q.status === 'pending');

  const images = form.watch('images') ?? [];
  const mainIndex = Math.max(0, images.findIndex((i) => i.isMain));

  const setMain = (index: number) => {
    getValues('images')?.forEach((_, i) => setValue(`images.${i}.isMain`, i === index, { shouldDirty: true }));
  };

  const removeAt = (index: number) => {
    const wasMain = getValues(`images.${index}.isMain`);
    remove(index);
    if (wasMain && (getValues('images')?.length ?? 0) > 0) setValue('images.0.isMain', true, { shouldDirty: true });
  };

  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= fields.length || from === to) return;
    move(from, to);
  };

  const patch = (key: string, p: Partial<UploadItem>) => setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...p } : i)));

  /** Validates on the client, then uploads files one by one so errors are per file. */
  const handleFiles = async (files: FileList | File[]) => {
    const list = [...files];
    const room = MAX_IMAGES - (getValues('images')?.length ?? 0);
    const items: (UploadItem & { file: File })[] = list.map((file, i) => {
      const key = `${Date.now()}-${i}-${file.name}`;
      if (i >= room) return { key, file, name: file.name, status: 'error', error: `Не больше ${MAX_IMAGES} фото у товара` };
      if (!TYPES.includes(file.type)) return { key, file, name: file.name, status: 'error', error: 'Допустимы JPEG, PNG, WebP, AVIF' };
      if (file.size > MAX_BYTES) return { key, file, name: file.name, status: 'error', error: 'Файл больше 8 МБ' };
      return { key, file, name: file.name, status: 'pending' };
    });
    setQueue((q) => [...q.filter((i) => i.status !== 'done'), ...items.map(({ file: _f, ...rest }) => rest)]);
    for (const item of items) {
      if (item.status !== 'pending') continue;
      patch(item.key, { status: 'uploading' });
      try {
        const fd = new FormData();
        fd.append('file', item.file);
        const res = await api.post<{ url: string; storageKey: string }>('/admin/products/images', fd);
        const isFirst = (getValues('images')?.length ?? 0) === 0;
        append({ url: res.url, storageKey: res.storageKey, alt: getValues('name') ?? '', colorId: null, isMain: isFirst }, { shouldFocus: false });
        patch(item.key, { status: 'done' });
      } catch (e) {
        patch(item.key, { status: 'error', error: errorMessage(e) });
      }
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const done = queue.filter((q) => q.status === 'done').length;
  const total = queue.filter((q) => q.status !== 'error').length;

  return (
    <div>
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 border border-dashed px-4 py-7 text-center transition-colors',
          dragOver ? 'border-ink bg-mist' : 'border-line bg-milk',
        )}
      >
        <ImagePlus className="size-6 stroke-[1.25] text-stone" aria-hidden />
        <p className="text-sm text-graphite">Перетащите фото сюда или</p>
        <Button type="button" size="sm" variant="outline" disabled={disabled || fields.length >= MAX_IMAGES} onClick={() => inputRef.current?.click()}>
          Выбрать файлы
        </Button>
        <p className="text-xs text-stone">
          JPEG, PNG, WebP, AVIF · до 8 МБ · не больше {MAX_IMAGES} фото. Изображения сжимаются в WebP на сервере.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Загрузить фото"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {queue.length > 0 && (
        <div className="mt-3 border border-line" aria-live="polite">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-xs text-graphite">
              {uploading ? `Загрузка: ${done} из ${total}` : `Загружено ${done} из ${total}`}
            </p>
            {!uploading && (
              <button type="button" className="text-stone hover:text-ink" onClick={() => setQueue([])} aria-label="Скрыть список загрузок">
                <X className="size-4" />
              </button>
            )}
          </div>
          <ul className="max-h-40 divide-y divide-line overflow-y-auto">
            {queue.map((q) => (
              <li key={q.key} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                <span className="min-w-0 truncate">{q.name}</span>
                <span
                  className={cn('shrink-0', q.status === 'error' ? 'text-danger' : q.status === 'done' ? 'text-success' : 'text-stone')}
                >
                  {q.status === 'uploading' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Spinner className="size-3" /> загрузка
                    </span>
                  ) : q.status === 'pending' ? (
                    'в очереди'
                  ) : q.status === 'done' ? (
                    'готово'
                  ) : (
                    q.error
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fields.length > 0 && (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((f, i) => (
            <li
              key={f.fieldKey}
              draggable={!disabled}
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (dragIndex !== null) e.preventDefault();
              }}
              onDrop={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                e.stopPropagation();
                moveTo(dragIndex, i);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn('flex gap-3 border bg-paper p-2.5', i === mainIndex ? 'border-ink' : 'border-line', dragIndex === i && 'opacity-50')}
            >
              <div className="relative h-24 w-20 shrink-0 cursor-grab overflow-hidden bg-mist">
                <img src={imageUrl(f.url, 160)} alt="" className="size-full object-cover" />
                {i === mainIndex && <span className="label absolute inset-x-0 bottom-0 bg-ink py-0.5 text-center text-milk">Главное</span>}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input aria-label={`Alt-текст фото ${i + 1}`} placeholder="Alt-текст" className="h-9 text-xs" {...register(`images.${i}.alt`)} />
                <NativeSelect aria-label={`Цвет фото ${i + 1}`} className="h-9 text-xs" {...register(`images.${i}.colorId`, { setValueAs: (v) => v || null })}>
                  <option value="">Для всех цветов</option>
                  {colors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
                <div className="flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => moveTo(i, i - 1)} aria-label={`Переместить фото ${i + 1} выше`}>
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === fields.length - 1}
                    onClick={() => moveTo(i, i + 1)}
                    aria-label={`Переместить фото ${i + 1} ниже`}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setMain(i)}
                    aria-pressed={i === mainIndex}
                    aria-label={`Сделать фото ${i + 1} главным`}
                  >
                    <Star className={cn(i === mainIndex && 'fill-current')} />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" onClick={() => removeAt(i)} aria-label={`Удалить фото ${i + 1}`}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

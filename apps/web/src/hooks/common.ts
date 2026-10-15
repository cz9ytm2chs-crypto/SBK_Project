import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { CategoryDTO, PublicSettingsDTO } from '@silt/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';

export function useDebounce<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export const useSettings = () =>
  useQuery({ queryKey: qk.settings, queryFn: () => api.get<PublicSettingsDTO>('/content/settings'), staleTime: 10 * 60_000 });

export const useCategories = () =>
  useQuery({ queryKey: qk.categories, queryFn: () => api.get<CategoryDTO[]>('/categories'), staleTime: 5 * 60_000 });

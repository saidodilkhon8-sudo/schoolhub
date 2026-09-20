import React, { useState } from 'react';
import { Database, Key, ExternalLink, Check, AlertTriangle, X } from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export function SupabaseSetupBanner() {
  const { isConfigured, url } = getSupabaseCredentials();
  const [isOpen, setIsOpen] = useState(!isConfigured);
  const [inputUrl, setInputUrl] = useState(url || '');
  const [inputKey, setInputKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  if (isConfigured && !isOpen) {
    return null;
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) {
      showToast('Заполните Project URL и Anon Key', 'error');
      return;
    }
    if (!inputUrl.startsWith('https://')) {
      showToast('URL должен начинаться с https://', 'error');
      return;
    }
    setIsSaving(true);
    saveSupabaseCredentials(inputUrl.trim(), inputKey.trim());
  };

  return (
    <div className="bg-zinc-900 border-b border-zinc-800 text-xs sm:text-sm px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-zinc-200">
          <Database className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            {isConfigured ? (
              <span className="text-emerald-400 font-medium">Подключено к Supabase ({new URL(url).hostname})</span>
            ) : (
              <span>Для работы базы данных укажите <strong>Supabase URL</strong> и <strong>Anon Key</strong></span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!isConfigured && (
            <button
              onClick={() => setIsOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg font-medium transition-colors"
            >
              Настроить подключение
            </button>
          )}
          {isConfigured && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-zinc-400 hover:text-zinc-200 underline transition-colors"
            >
              Изменить ключи
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-zinc-800 max-w-xl">
          <p className="text-zinc-400 text-xs mb-3">
            Вы можете указать параметры в файле <code className="text-blue-300 font-mono">.env</code> или ввести их здесь (сохраняются в вашем браузере). Схема таблиц и RLS доступны в <code className="text-blue-300 font-mono">supabase/schema.sql</code>.
          </p>
          <form onSubmit={handleSave} className="space-y-2.5">
            <div>
              <label className="block text-zinc-300 text-xs font-medium mb-1">Project URL:</label>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-xs font-medium mb-1">Anon Public Key:</label>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-zinc-100 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-zinc-500">Service role key никогда не требуется в приложении</span>
              <div className="flex items-center gap-2">
                {isConfigured && (
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-zinc-400 hover:text-zinc-200 px-2.5 py-1 text-xs"
                  >
                    Скрыть
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить и подключить'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

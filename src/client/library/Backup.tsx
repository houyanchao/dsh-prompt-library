import { useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from '../locales.ts'
import { exportBackup, restoreBackup } from './storage.ts'
import { toast } from '../ui/toast.tsx'
import css from './panel.module.css'

type T = TranslateNS<typeof NS>

const SYNC_TOAST_COLOR = {
  light: { backgroundColor: 'var(--dsw-alias-tooltip-bg)', textColor: '#ffffff', borderColor: 'var(--dsw-alias-tooltip-bg)' },
  dark: { backgroundColor: 'var(--dsw-alias-tooltip-bg)', textColor: '#f5f5f5', borderColor: 'var(--dsw-alias-tooltip-bg)' },
}

/** 提示词备份的本地文件导入与导出。 */
export function PromptBackupTab({ t }: { readonly t: T }) {
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge')
  const [status, setStatus] = useState<{ type: 'loading' | 'error'; message: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 导出数据（原 handleExport）。 */
  const handleExport = (): void => {
    try {
      setStatus({ type: 'loading', message: t('panel.syncExporting') })
      exportBackup()
      setStatus(null)
      toast.success(t('panel.syncExportSuccess'), SYNC_TOAST_COLOR)
    } catch {
      setStatus(null)
      toast.error(t('panel.syncExportFailed'), SYNC_TOAST_COLOR)
    }
  }

  /** 导入数据（原 handleImport）。 */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = e.currentTarget
    const file = input.files?.[0]
    if (file === undefined) return

    // 重置 input，允许重复选择同一文件。
    input.value = ''

    try {
      setStatus({ type: 'loading', message: t('panel.syncImporting') })

      const text = await file.text()
      if (fileInputRef.current !== input) return
      const importData: unknown = JSON.parse(text)

      restoreBackup(importData, importMode)
      setStatus(null)
      toast.success(t('panel.syncImportSuccess'))
    } catch (error) {
      if (fileInputRef.current !== input) return
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: `${t('panel.syncImportFailed')}: ${message}` })
    }
  }

  return (
    <div className={css.syncRoot}>
      <div className={css.syncSection}>
        <div className={css.syncHint}>{t('panel.syncHint')}</div>

        <div className={css.syncGroup}>
          <div className={css.syncItem}>
            <div className={css.syncItemLabel}>{t('panel.syncExportLabel')}</div>
            <div className={css.syncItemBody}>
              <button type="button" className={css.syncBtn} onClick={handleExport}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="12" y1="12" x2="12" y2="18" />
                  <polyline points="9,15 12,18 15,15" />
                </svg>
                {t('panel.syncExportBtn')}
              </button>
            </div>
          </div>
          <div className={css.syncItem}>
            <div className={css.syncItemLabel}>{t('panel.syncImportLabel')}</div>
            <div className={css.syncItemBody}>
              <div className={css.importOptions}>
                <label className={css.importOption}>
                  <input
                    type="radio"
                    name="dsh-prompt-library-import-mode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => { setImportMode('merge') }}
                  />
                  <span className={css.optionRadio} />
                  <span className={css.optionContent}>
                    <span className={css.optionLabel}>{t('panel.syncModeMerge')}</span>
                    <span className={css.optionDesc}>{t('panel.syncModeMergeDesc')}</span>
                  </span>
                </label>
                <label className={css.importOption}>
                  <input
                    type="radio"
                    name="dsh-prompt-library-import-mode"
                    value="overwrite"
                    checked={importMode === 'overwrite'}
                    onChange={() => { setImportMode('overwrite') }}
                  />
                  <span className={css.optionRadio} />
                  <span className={css.optionContent}>
                    <span className={css.optionLabel}>{t('panel.syncModeOverwrite')}</span>
                    <span className={css.optionDesc}>{t('panel.syncModeOverwriteDesc')}</span>
                  </span>
                </label>
              </div>
              <button
                type="button"
                className={css.syncBtn}
                onClick={() => { fileInputRef.current?.click() }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <polyline points="9,15 12,12 15,15" />
                </svg>
                {t('panel.syncImportBtn')}
              </button>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => { void handleImport(e) }}
        />
      </div>

      {status !== null
        ? (
          <div
            className={`${css.syncStatus} ${status.type === 'loading' ? css.syncStatusLoading : css.syncStatusError}`}
          >
            {status.message}
          </div>
        )
        : null}
    </div>
  )
}

'use client'

import { useState, useCallback, useRef } from 'react'
import { imports, schemas, RightsSchema, BulkImportResponse, ImportResult } from '@/lib/api'
import { Upload, FileText, Download, AlertCircle, CheckCircle, XCircle, Loader2, X } from 'lucide-react'

interface BulkImportDialogProps {
  catalogId: string
  token: string
  onSuccess?: (result: BulkImportResponse) => void
  onClose: () => void
}

type ImportStep = 'select' | 'preview' | 'importing' | 'complete'

interface ParsedRow {
  index: number
  data: Record<string, string>
  valid: boolean
  errors: string[]
}

export function BulkImportDialog({ catalogId, token, onSuccess, onClose }: BulkImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('select')
  const [file, setFile] = useState<File | null>(null)
  const [rightsType, setRightsType] = useState('')
  const [availableSchemas, setAvailableSchemas] = useState<RightsSchema[]>([])
  const [autoProcess, setAutoProcess] = useState(true)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<BulkImportResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch available schemas on mount
  useState(() => {
    schemas.list(token).then(res => {
      setAvailableSchemas(res.schemas)
      if (res.schemas.length > 0) {
        setRightsType(res.schemas[0].id)
      }
    }).catch(console.error)
  })

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    setParseError(null)
    setParsedRows([])

    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.json')) {
      setParseError('Please select a CSV or JSON file')
      return
    }

    try {
      const text = await selectedFile.text()

      if (selectedFile.name.endsWith('.json')) {
        // Parse JSON
        const data = JSON.parse(text)
        const items = Array.isArray(data) ? data : data.entities || []

        const rows: ParsedRow[] = items.map((item: Record<string, unknown>, index: number) => {
          const errors: string[] = []
          if (!item.title) errors.push('Missing title')

          return {
            index,
            data: {
              title: String(item.title || ''),
              entity_key: String(item.entity_key || ''),
              content: typeof item.content === 'object' ? JSON.stringify(item.content) : '',
              ai_permissions: typeof item.ai_permissions === 'object' ? JSON.stringify(item.ai_permissions) : '',
            },
            valid: errors.length === 0,
            errors,
          }
        })

        setParsedRows(rows)
        setStep('preview')

      } else {
        // Parse CSV
        const lines = text.split('\n').filter(line => line.trim())
        if (lines.length < 2) {
          setParseError('CSV must have at least a header row and one data row')
          return
        }

        const headers = parseCSVLine(lines[0])
        const titleIndex = headers.findIndex(h => h.toLowerCase() === 'title')

        if (titleIndex === -1) {
          setParseError('CSV must have a "title" column')
          return
        }

        const rows: ParsedRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i])
          const errors: string[] = []

          const data: Record<string, string> = {}
          headers.forEach((header, idx) => {
            data[header.toLowerCase()] = values[idx] || ''
          })

          if (!data.title?.trim()) {
            errors.push('Missing title')
          }

          rows.push({
            index: i - 1,
            data,
            valid: errors.length === 0,
            errors,
          })
        }

        setParsedRows(rows)
        setStep('preview')
      }
    } catch (err) {
      setParseError(`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [])

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  // Execute import
  const handleImport = async () => {
    if (!file || !rightsType) return

    setIsLoading(true)
    setStep('importing')

    try {
      let result: BulkImportResponse

      if (file.name.endsWith('.csv')) {
        result = await imports.csv(catalogId, file, rightsType, token, autoProcess)
      } else {
        // JSON import
        const text = await file.text()
        const data = JSON.parse(text)
        const items = Array.isArray(data) ? data : data.entities || []

        const entities = items.map((item: Record<string, unknown>) => ({
          rights_type: rightsType,
          title: String(item.title || ''),
          entity_key: item.entity_key ? String(item.entity_key) : undefined,
          content: typeof item.content === 'object' ? item.content : undefined,
          ai_permissions: typeof item.ai_permissions === 'object' ? item.ai_permissions : undefined,
        }))

        result = await imports.bulk(catalogId, entities, token, autoProcess)
      }

      setImportResult(result)
      setStep('complete')
      onSuccess?.(result)

    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed')
      setStep('preview')
    } finally {
      setIsLoading(false)
    }
  }

  // Download template
  const handleDownloadTemplate = () => {
    if (!rightsType) return
    window.open(imports.getTemplate(catalogId, rightsType), '_blank')
  }

  const validCount = parsedRows.filter(r => r.valid).length
  const invalidCount = parsedRows.filter(r => !r.valid).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-slate-900">Bulk Import</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'select' && (
            <div className="space-y-6">
              {/* Rights Type Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rights Type
                </label>
                <select
                  value={rightsType}
                  onChange={(e) => setRightsType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableSchemas.map(schema => (
                    <option key={schema.id} value={schema.id}>
                      {schema.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600 mb-1">
                  Drag and drop a CSV or JSON file, or click to browse
                </p>
                <p className="text-xs text-slate-500">
                  Supports .csv and .json files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
              </div>

              {/* Template Download */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-600">Need a template?</span>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={!rightsType}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400"
                >
                  <Download className="h-4 w-4" />
                  Download CSV Template
                </button>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{parseError}</span>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{file?.name}</span>
                </div>
                <button
                  onClick={() => { setStep('select'); setFile(null); setParsedRows([]) }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Change file
                </button>
              </div>

              {/* Validation Summary */}
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-sm text-red-600">
                    <XCircle className="h-4 w-4" />
                    {invalidCount} with errors
                  </span>
                )}
              </div>

              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">#</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Title</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Entity Key</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedRows.slice(0, 20).map((row) => (
                        <tr key={row.index} className={row.valid ? '' : 'bg-red-50'}>
                          <td className="px-3 py-2 text-slate-500">{row.index + 1}</td>
                          <td className="px-3 py-2 text-slate-900 truncate max-w-[200px]">
                            {row.data.title || <span className="text-red-500 italic">Missing</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-600 truncate max-w-[150px]">
                            {row.data.entity_key || '-'}
                          </td>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <span className="text-xs text-red-600">{row.errors.join(', ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 20 && (
                  <div className="px-3 py-2 bg-slate-50 text-sm text-slate-500 text-center">
                    +{parsedRows.length - 20} more rows
                  </div>
                )}
              </div>

              {/* Auto Process Option */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoProcess}
                  onChange={(e) => setAutoProcess(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">
                  Auto-generate embeddings after import
                </span>
              </label>

              {parseError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span className="text-sm">{parseError}</span>
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 text-center">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Importing {parsedRows.length} entities...</p>
            </div>
          )}

          {step === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="py-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Import Complete</h3>
                <p className="text-slate-600">
                  {importResult.successful} of {importResult.total} entities imported successfully
                </p>
                {importResult.job_id && (
                  <p className="text-sm text-blue-600 mt-2">
                    Embedding generation started
                  </p>
                )}
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900">{importResult.total}</div>
                  <div className="text-xs text-slate-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.successful}</div>
                  <div className="text-xs text-slate-500">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                  <div className="text-xs text-slate-500">Failed</div>
                </div>
              </div>

              {/* Failed Items */}
              {importResult.failed > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-red-50 text-sm font-medium text-red-700">
                    Failed Imports
                  </div>
                  <div className="max-h-40 overflow-auto divide-y">
                    {importResult.results.filter(r => !r.success).map((result) => (
                      <div key={result.index} className="px-3 py-2 text-sm">
                        <span className="font-medium text-slate-700">Row {result.index + 1}:</span>
                        <span className="text-slate-600 ml-2">{result.title}</span>
                        <span className="text-red-600 ml-2">- {result.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-slate-50">
          {step === 'select' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('select')}
                className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0 || isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import {validCount} Entities
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function to parse CSV lines (handles quoted values)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

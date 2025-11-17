import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUploadAttendance } from '@/hooks/useVendorRequests'
import { Upload, FileCheck, X } from 'lucide-react'

interface VendorFileUploadProps {
  requestId: string
  onSuccess?: () => void
}

export function VendorFileUpload({ requestId, onSuccess }: VendorFileUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const uploadAttendance = useUploadAttendance()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length === 0) return

    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]

    const validFiles: File[] = []
    const errors: string[] = []

    selectedFiles.forEach(file => {
      // Validate file type
      if (!allowedTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        errors.push(`${file.name}: Invalid file type. Only CSV and XLSX files are allowed.`)
        return
      }

      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        errors.push(`${file.name}: File size exceeds 50MB limit`)
        return
      }

      validFiles.push(file)
    })

    if (errors.length > 0) {
      alert(errors.join('\n'))
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles])
    }

    // Reset input to allow selecting the same file again
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select at least one file to upload')
      return
    }

    if (!requestId) {
      alert('Request ID is missing. Please refresh the page and try again.')
      return
    }

    try {
      console.log('Starting upload:', { requestId, filesCount: files.length, fileNames: files.map(f => f.name) })
      await uploadAttendance.mutateAsync({ requestId, files })
      setFiles([])
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Upload error:', error)
      // Error is already handled by the mutation's onError callback
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="attendance-file">Attendance Files (CSV/XLSX)</Label>
        <div className="flex items-center gap-4">
          <Input
            id="attendance-file"
            type="file"
            multiple
            accept=".csv,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            disabled={uploadAttendance.isPending}
            className="cursor-pointer"
          />
        </div>
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                <FileCheck className="h-4 w-4 text-green-600" />
                <span className="flex-1">{file.name}</span>
                <span className="text-gray-400">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-red-600 hover:text-red-800"
                  disabled={uploadAttendance.isPending}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-sm text-gray-500">
          Upload attendance files for approved CPD requests. Files must be CSV or XLSX format, max 50MB each.
        </p>
      </div>

      {files.length > 0 && (
        <Button
          onClick={handleUpload}
          disabled={uploadAttendance.isPending}
          className="w-full sm:w-auto"
        >
          {uploadAttendance.isPending ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Uploading {files.length} file{files.length > 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {files.length} File{files.length > 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}
    </div>
  )
}


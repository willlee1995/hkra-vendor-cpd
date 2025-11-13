import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUploadAttendance } from '@/hooks/useVendorRequests'
import { Upload, FileCheck } from 'lucide-react'

interface VendorFileUploadProps {
  requestId: string
  onSuccess?: () => void
}

export function VendorFileUpload({ requestId, onSuccess }: VendorFileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const uploadAttendance = useUploadAttendance()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]

    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
      alert('Please upload a CSV or XLSX file')
      return
    }

    // Validate file size (50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB')
      return
    }

    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    try {
      await uploadAttendance.mutateAsync({ requestId, file })
      setFile(null)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Upload error:', error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="attendance-file">Attendance File (CSV/XLSX)</Label>
        <div className="flex items-center gap-4">
          <Input
            id="attendance-file"
            type="file"
            accept=".csv,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileChange}
            disabled={uploadAttendance.isPending}
            className="cursor-pointer"
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileCheck className="h-4 w-4" />
              <span>{file.name}</span>
              <span className="text-gray-400">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Upload attendance file for approved CPD requests. File must be CSV or XLSX format, max 50MB.
        </p>
      </div>

      {file && (
        <Button
          onClick={handleUpload}
          disabled={uploadAttendance.isPending}
          className="w-full sm:w-auto"
        >
          {uploadAttendance.isPending ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload Attendance File
            </>
          )}
        </Button>
      )}
    </div>
  )
}


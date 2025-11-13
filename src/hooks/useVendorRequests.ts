import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorService } from '@/lib/vendorService'
import type {
  VendorRequest,
  CreateVendorRequestInput,
  UpdateVendorRequestInput,
  VendorRequestsFilter,
} from '@/lib/vendorTypes'
import { toast } from 'sonner'

export function useVendorRequests(filter?: VendorRequestsFilter) {
  return useQuery({
    queryKey: ['vendor-requests', filter],
    queryFn: () => vendorService.getRequests(filter),
  })
}

export function useVendorRequest(id: string) {
  return useQuery({
    queryKey: ['vendor-request', id],
    queryFn: () => vendorService.getRequest(id),
    enabled: !!id,
  })
}

export function useCreateVendorRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateVendorRequestInput) => vendorService.createRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-requests'] })
      toast.success('Request created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create request')
    },
  })
}

export function useUpdateVendorRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVendorRequestInput }) =>
      vendorService.updateRequest(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-requests'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-request', data.id] })
      toast.success('Request updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update request')
    },
  })
}

export function useWithdrawVendorRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => vendorService.withdrawRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-requests'] })
      toast.success('Request withdrawn successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to withdraw request')
    },
  })
}

export function useUploadAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, file }: { requestId: string; file: File }) =>
      vendorService.uploadAttendance(requestId, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vendor-requests'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-request', data.id] })
      toast.success('Attendance file uploaded successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload attendance file')
    },
  })
}

export function useUploadPoster() {
  return useMutation({
    mutationFn: (file: File) => vendorService.uploadPoster(file),
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload poster')
    },
  })
}


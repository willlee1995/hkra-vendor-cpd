import { vendorApiClient } from './vendorApiClient'
import type {
  VendorRequest,
  CreateVendorRequestInput,
  UpdateVendorRequestInput,
  VendorRequestsFilter,
} from './vendorTypes'

export const vendorService = {
  // Get requests with optional filtering
  getRequests: async (filter?: VendorRequestsFilter): Promise<VendorRequest[]> => {
    return vendorApiClient.getRequests(filter)
  },

  // Get single request with full details
  getRequest: async (id: string): Promise<VendorRequest> => {
    return vendorApiClient.getRequest(id)
  },

  // Create new request
  createRequest: async (input: CreateVendorRequestInput): Promise<VendorRequest> => {
    return vendorApiClient.createRequest(input)
  },

  // Update existing request
  updateRequest: async (id: string, input: UpdateVendorRequestInput): Promise<VendorRequest> => {
    return vendorApiClient.updateRequest(id, input)
  },

  // Withdraw request
  withdrawRequest: async (id: string): Promise<VendorRequest> => {
    return vendorApiClient.withdrawRequest(id)
  },

  // Upload attendance files (supports multiple files)
  uploadAttendance: async (requestId: string, files: File[]): Promise<VendorRequest> => {
    const result = await vendorApiClient.uploadAttendance(requestId, files)
    return result.request
  },

  // Upload poster files (supports multiple files)
  uploadPoster: async (files: File[]): Promise<string[]> => {
    return vendorApiClient.uploadPoster(files)
  },
}


import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VendorStatusBadge } from './VendorStatusBadge'
import { format } from 'date-fns'
import { ArrowUpDown, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { VendorRequest } from '@/lib/vendorTypes'

interface VendorRequestTableProps {
  data: VendorRequest[]
  isLoading?: boolean
  isAdmin?: boolean // If true, links will go to admin pages
}

// Helper function to format time (HH:MM) to 12-hour format
const formatTime = (time: string | null | undefined): string => {
  if (!time) return '-'
  try {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  } catch {
    return time
  }
}

export function VendorRequestTable({ data, isLoading, isAdmin = false }: VendorRequestTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  // Only use status filter for vendor view, admin dashboard handles its own filtering
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const columns: ColumnDef<VendorRequest>[] = [
    {
      accessorKey: 'event_name',
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer hover:text-foreground select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Event Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </div>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue('event_name')}</div>
      ),
    },
    ...(isAdmin ? [{
      accessorKey: 'vendor_company_name',
      header: ({ column }: any) => {
        return (
          <div
            className="flex items-center cursor-pointer hover:text-foreground select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Vendor Company
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </div>
        )
      },
      cell: ({ row }: any) => (
        <div className="text-sm">{row.getValue('vendor_company_name')}</div>
      ),
    } as ColumnDef<VendorRequest>] : []),
    {
      accessorKey: 'event_start_date',
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer hover:text-foreground select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Start Date & Time
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </div>
        )
      },
      cell: ({ row }) => {
        const date = row.getValue('event_start_date') as string
        const request = row.original
        const formattedDate = format(new Date(date), 'MMM dd, yyyy')
        if (request.event_start_time) {
          const formattedTime = formatTime(request.event_start_time)
          return (
            <div>
              <div>{formattedDate}</div>
              <div className="text-sm text-muted-foreground">{formattedTime}</div>
            </div>
          )
        }
        return formattedDate
      },
    },
    {
      accessorKey: 'event_end_date',
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer hover:text-foreground select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            End Date & Time
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </div>
        )
      },
      cell: ({ row }) => {
        const date = row.getValue('event_end_date') as string
        const request = row.original
        const formattedDate = format(new Date(date), 'MMM dd, yyyy')
        if (request.event_end_time) {
          const formattedTime = formatTime(request.event_end_time)
          return (
            <div>
              <div>{formattedDate}</div>
              <div className="text-sm text-muted-foreground">{formattedTime}</div>
            </div>
          )
        }
        return formattedDate
      },
    },
    {
      accessorKey: 'expected_cpd_points',
      header: ({ column }) => {
        return (
          <div
            className="flex items-center cursor-pointer hover:text-foreground select-none"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            CPD Points
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </div>
        )
      },
      cell: ({ row }) => {
        const points = row.getValue('expected_cpd_points') as number
        return <div className="font-medium">{points}</div>
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return <VendorStatusBadge status={status as any} />
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const request = row.original
        const detailPath = isAdmin ? `/admin/request/${request.id}` : `/vendor/request/${request.id}`
        return (
          <Link to={detailPath}>
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>
          </Link>
        )
      },
    },
  ]

  // Apply status filter to data (only for vendor view, admin dashboard handles filtering)
  const filteredData = isAdmin
    ? data // Admin dashboard already filters the data before passing it
    : statusFilter === 'all'
    ? data
    : data.filter(item => item.status === statusFilter)

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading requests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search events..."
          value={(table.getColumn('event_name')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('event_name')?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        {!isAdmin && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}


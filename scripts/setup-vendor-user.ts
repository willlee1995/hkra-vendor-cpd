/**
 * Helper script to set up a vendor user
 *
 * Usage:
 * 1. Set environment variables:
 *    SUPABASE_URL=your_supabase_url
 *    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *
 * 2. Run: bun run scripts/setup-vendor-user.ts vendor@example.com "Company Name" "Contact Name"
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function setupVendorUser(
  email: string,
  password: string,
  companyName: string,
  contactName: string,
  contactPhone?: string
) {
  try {
    console.log(`Setting up vendor user: ${email}`)

    // Step 1: Create or get user
    let userId: string

    // Try to get existing user
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email)

    if (existingUser?.user) {
      console.log('User already exists, updating metadata...')
      userId = existingUser.user.id

      // Update user metadata
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          role: 'vendor',
        },
      })

      if (updateError) {
        throw updateError
      }
    } else {
      // Create new user
      console.log('Creating new user...')
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'vendor',
        },
      })

      if (createError) {
        throw createError
      }

      if (!newUser.user) {
        throw new Error('Failed to create user')
      }

      userId = newUser.user.id
      console.log(`User created with ID: ${userId}`)
    }

    // Step 2: Create or update vendor record
    const { data: vendor, error: vendorError } = await supabaseAdmin
      .from('vendors')
      .upsert(
        {
          user_id: userId,
          company_name: companyName,
          contact_name: contactName,
          contact_email: email,
          contact_phone: contactPhone || null,
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single()

    if (vendorError) {
      throw vendorError
    }

    console.log('✅ Vendor user setup complete!')
    console.log(`   User ID: ${userId}`)
    console.log(`   Email: ${email}`)
    console.log(`   Company: ${companyName}`)
    console.log(`   Vendor Record ID: ${vendor.id}`)

    return { userId, vendorId: vendor.id }
  } catch (error: any) {
    console.error('❌ Error setting up vendor user:', error.message)
    throw error
  }
}

// Get command line arguments
const args = process.argv.slice(2)

if (args.length < 4) {
  console.log('Usage: bun run scripts/setup-vendor-user.ts <email> <password> <companyName> <contactName> [contactPhone]')
  console.log('')
  console.log('Example:')
  console.log('  bun run scripts/setup-vendor-user.ts vendor@example.com password123 "Acme Corp" "John Doe" "+1234567890"')
  process.exit(1)
}

const [email, password, companyName, contactName, contactPhone] = args

setupVendorUser(email, password, companyName, contactName, contactPhone)
  .then(() => {
    console.log('\n✅ Setup complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  })


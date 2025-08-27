import { clerkClient } from '@clerk/clerk-sdk-node';

// Initialize Clerk with environment variables
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.warn('⚠️ CLERK_SECRET_KEY not found in environment variables');
  console.warn('Clerk integration will not work properly');
}

// Clerk client is automatically configured when imported
// but we can add additional configuration here if needed

export { clerkClient };
export default clerkClient;

import { clerkClient } from '../config/clerk';

export interface ClerkUserData {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  publicMetadata?: Record<string, any>;
}

export interface ClerkUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  publicMetadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class ClerkService {
  /**
   * Create a new user in Clerk
   */
  static async createUser(userData: ClerkUserData): Promise<ClerkUser> {
    try {
      const user = await clerkClient.users.createUser({
        emailAddress: [userData.email],
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: userData.password,
        publicMetadata: userData.publicMetadata || {},
      });

      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        publicMetadata: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      };
    } catch (error) {
      console.error('Failed to create user in Clerk:', error);
      throw new Error(`Failed to create user in Clerk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user by ID from Clerk
   */
  static async getUserById(userId: string): Promise<ClerkUser | null> {
    try {
      const user = await clerkClient.users.getUser(userId);
      
      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        publicMetadata: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      };
    } catch (error) {
      console.error('Failed to get user from Clerk:', error);
      return null;
    }
  }

  /**
   * Update user in Clerk
   */
  static async updateUser(userId: string, updates: Partial<ClerkUserData>): Promise<ClerkUser> {
    try {
      const updateData: any = {};
      
      if (updates.firstName) updateData.firstName = updates.firstName;
      if (updates.lastName) updateData.lastName = updates.lastName;
      if (updates.publicMetadata) updateData.publicMetadata = updates.publicMetadata;

      const user = await clerkClient.users.updateUser(userId, updateData);

      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        publicMetadata: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      };
    } catch (error) {
      console.error('Failed to update user in Clerk:', error);
      throw new Error(`Failed to update user in Clerk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete user from Clerk
   */
  static async deleteUser(userId: string): Promise<void> {
    try {
      await clerkClient.users.deleteUser(userId);
    } catch (error) {
      console.error('Failed to delete user from Clerk:', error);
      throw new Error(`Failed to delete user from Clerk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all users from Clerk (paginated)
   */
  static async getAllUsers(limit: number = 100, offset: number = 0): Promise<ClerkUser[]> {
    try {
      const response = await clerkClient.users.getUserList({
        limit,
        offset,
      });

      // Handle the response properly based on Clerk's API structure
      const users = Array.isArray(response) ? response : response.data || [];
      
      return users.map((user: any) => ({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        publicMetadata: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      }));
    } catch (error) {
      console.error('Failed to get users from Clerk:', error);
      throw new Error(`Failed to get users from Clerk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search users in Clerk
   */
  static async searchUsers(query: string, limit: number = 100): Promise<ClerkUser[]> {
    try {
      const response = await clerkClient.users.getUserList({
        query,
        limit,
      });

      // Handle the response properly based on Clerk's API structure
      const users = Array.isArray(response) ? response : response.data || [];
      
      return users.map((user: any) => ({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        publicMetadata: user.publicMetadata,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      }));
    } catch (error) {
      console.error('Failed to search users in Clerk:', error);
      throw new Error(`Failed to search users from Clerk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

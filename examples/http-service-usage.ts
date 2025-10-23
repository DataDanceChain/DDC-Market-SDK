/**
 * HTTP Service Usage Examples
 *
 * Demonstrates how to use the HTTP service for API requests with type safety
 */

import { requestGet, requestPost, requestPut, requestPatch, requestDelete } from '../src/service';
import { httpService, createHttpService } from '../src/service';
import type { ApiResponse } from '../src/types';

// ============================================================================
// Example Type Definitions
// ============================================================================

/**
 * Example: User data type
 */
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

/**
 * Example: NFT metadata type
 */
interface NFTMetadata {
  tokenId: string;
  owner: string;
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

/**
 * Example: API list response
 */
interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// Basic Usage Examples
// ============================================================================

/**
 * Example 1: Simple GET request with type safety
 */
async function getUserById(userId: string): Promise<User | null> {
  const response = await requestGet<User>(`/api/users/${userId}`);

  if (response.data) {
    console.log('User found:', response.data.name);
    return response.data;
  } else if (response.err) {
    console.error('Error fetching user:', response.err.message);
    return null;
  }

  return null;
}

/**
 * Example 2: GET request with query parameters
 */
async function searchUsers(keyword: string, page: number = 1): Promise<ListResponse<User> | null> {
  const response = await requestGet<ListResponse<User>>('/api/users/search', {
    params: {
      q: keyword,
      page,
      pageSize: 20,
    },
  });

  if (response.data) {
    console.log(`Found ${response.data.total} users`);
    return response.data;
  } else if (response.err) {
    console.error('Search failed:', response.err.message);
    return null;
  }

  return null;
}

/**
 * Example 3: POST request to create a resource
 */
async function createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User | null> {
  const response = await requestPost<User>('/api/users', userData);

  if (response.data) {
    console.log('User created with ID:', response.data.id);
    return response.data;
  } else if (response.err) {
    console.error('Failed to create user:', response.err.message);
    return null;
  }

  return null;
}

/**
 * Example 4: PUT request to update a resource
 */
async function updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
  const response = await requestPut<User>(`/api/users/${userId}`, updates);

  if (response.data) {
    console.log('User updated:', response.data.id);
    return response.data;
  } else if (response.err) {
    console.error('Failed to update user:', response.err.message);
    return null;
  }

  return null;
}

/**
 * Example 5: PATCH request for partial updates
 */
async function updateUserEmail(userId: string, newEmail: string): Promise<User | null> {
  const response = await requestPatch<User>(`/api/users/${userId}`, { email: newEmail });

  if (response.data) {
    console.log('Email updated for user:', response.data.id);
    return response.data;
  } else if (response.err) {
    console.error('Failed to update email:', response.err.message);
    return null;
  }

  return null;
}

/**
 * Example 6: DELETE request
 */
async function deleteUser(userId: string): Promise<boolean> {
  const response = await requestDelete<{ success: boolean }>(`/api/users/${userId}`);

  if (response.data) {
    console.log('User deleted successfully');
    return true;
  } else if (response.err) {
    console.error('Failed to delete user:', response.err.message);
    return false;
  }

  return false;
}

// ============================================================================
// Advanced Usage: Custom Headers and Configuration
// ============================================================================

/**
 * Example 7: Request with custom headers (e.g., authentication)
 */
async function getProtectedResource(token: string): Promise<any> {
  const response = await requestGet('/api/protected', {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-API-Version': '2.0',
    },
  });

  if (response.data) {
    return response.data;
  } else if (response.err) {
    if (response.err.response?.status === 401) {
      console.error('Unauthorized: Invalid token');
    } else {
      console.error('Error:', response.err.message);
    }
    return null;
  }
}

/**
 * Example 8: Request with custom timeout
 */
async function getWithTimeout(): Promise<any> {
  const response = await requestGet('/api/slow-endpoint', {
    timeout: 5000, // 5 seconds
  });

  if (response.data) {
    return response.data;
  } else if (response.err) {
    if (response.err.code === 'ECONNABORTED') {
      console.error('Request timeout');
    }
    return null;
  }
}

// ============================================================================
// Using HttpService Class Directly
// ============================================================================

/**
 * Example 9: Using the default httpService instance
 */
async function useHttpServiceDirectly() {
  // Set base URL for all requests
  httpService.setBaseURL('https://api.example.com');

  // Set default headers for all requests
  httpService.setHeaders({
    'X-Client-Name': 'DDC-Market-SDK',
    'X-Client-Version': '1.0.0',
  });

  // Make requests using the service
  const userResponse = await httpService.get<User>('/users/123');
  const createResponse = await httpService.post<User>('/users', {
    name: 'Alice',
    email: 'alice@example.com',
  });

  if (userResponse.data) {
    console.log('User:', userResponse.data.name);
  }

  if (createResponse.data) {
    console.log('Created user:', createResponse.data.id);
  }
}

/**
 * Example 10: Creating a custom HTTP service instance
 */
async function useCustomHttpService() {
  // Create a service for a specific API
  const nftApiService = createHttpService('https://nft-api.example.com', {
    timeout: 15000,
    headers: {
      'X-API-Key': 'your-api-key-here',
    },
  });

  // Use the custom service
  const nftResponse = await nftApiService.get<NFTMetadata>('/nfts/token-123');

  if (nftResponse.data) {
    console.log('NFT:', nftResponse.data.name);
    console.log('Owner:', nftResponse.data.owner);
  }

  // Create another service for a different API
  const userApiService = createHttpService('https://user-api.example.com');

  const userResponse = await userApiService.get<User>('/users/me');

  if (userResponse.data) {
    console.log('Current user:', userResponse.data.name);
  }
}

// ============================================================================
// Error Handling Patterns
// ============================================================================

/**
 * Example 11: Comprehensive error handling
 */
async function handleErrorsComprehensively() {
  const response = await requestGet<User>('/api/users/123');

  if (response.data) {
    // Success case
    console.log('User data:', response.data);
    return response.data;
  }

  if (response.err) {
    // Check for HTTP status codes
    if (response.err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = response.err.response.status;

      switch (status) {
        case 400:
          console.error('Bad request:', response.err.response.data);
          break;
        case 401:
          console.error('Unauthorized - please login');
          break;
        case 403:
          console.error('Forbidden - insufficient permissions');
          break;
        case 404:
          console.error('User not found');
          break;
        case 500:
          console.error('Server error');
          break;
        default:
          console.error('HTTP error:', status);
      }
    } else if (response.err.request) {
      // The request was made but no response was received
      console.error('No response received from server');
    } else {
      // Something happened in setting up the request
      console.error('Request setup error:', response.err.message);
    }

    return null;
  }

  return null;
}

/**
 * Example 12: Retry logic with exponential backoff
 */
async function fetchWithRetry<T>(
  url: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await requestGet<T>(url);

    if (response.data) {
      return response.data;
    }

    if (response.err) {
      // Don't retry on client errors (4xx)
      if (response.err.response && response.err.response.status < 500) {
        console.error('Client error, not retrying:', response.err.response.status);
        return null;
      }

      // Last attempt, don't wait
      if (attempt === maxRetries - 1) {
        console.error('Max retries reached');
        return null;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}

// ============================================================================
// Real-world API Integration Examples
// ============================================================================

/**
 * Example 13: NFT API integration
 */
class NFTApi {
  private service: ReturnType<typeof createHttpService>;

  constructor(baseURL: string, apiKey: string) {
    this.service = createHttpService(baseURL, {
      headers: {
        'X-API-Key': apiKey,
      },
    });
  }

  async getToken(tokenId: string): Promise<NFTMetadata | null> {
    const response = await this.service.get<NFTMetadata>(`/tokens/${tokenId}`);
    return response.data || null;
  }

  async listTokens(owner: string): Promise<NFTMetadata[]> {
    const response = await this.service.get<ListResponse<NFTMetadata>>('/tokens', {
      params: { owner },
    });
    return response.data?.items || [];
  }

  async transferToken(tokenId: string, to: string): Promise<boolean> {
    const response = await this.service.post<{ success: boolean }>(`/tokens/${tokenId}/transfer`, {
      to,
    });
    return response.data?.success || false;
  }
}

/**
 * Example 14: User API with authentication
 */
class UserApi {
  private service: ReturnType<typeof createHttpService>;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.service = createHttpService(baseURL);
  }

  async login(email: string, password: string): Promise<boolean> {
    const response = await this.service.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
    });

    if (response.data) {
      this.token = response.data.token;
      this.service.setHeaders({
        Authorization: `Bearer ${this.token}`,
      });
      return true;
    }

    return false;
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.token) {
      console.error('Not authenticated');
      return null;
    }

    const response = await this.service.get<User>('/users/me');
    return response.data || null;
  }

  async updateProfile(updates: Partial<User>): Promise<User | null> {
    if (!this.token) {
      console.error('Not authenticated');
      return null;
    }

    const response = await this.service.patch<User>('/users/me', updates);
    return response.data || null;
  }

  logout(): void {
    this.token = null;
    this.service.setHeaders({ Authorization: '' });
  }
}

// ============================================================================
// Usage Examples
// ============================================================================

async function runExamples() {
  // Basic usage
  await getUserById('123');
  await searchUsers('alice');
  await createUser({ name: 'Bob', email: 'bob@example.com' });

  // Advanced usage
  await useHttpServiceDirectly();
  await useCustomHttpService();

  // Error handling
  await handleErrorsComprehensively();
  await fetchWithRetry('/api/users/123');

  // API classes
  const nftApi = new NFTApi('https://nft-api.example.com', 'your-api-key');
  await nftApi.getToken('token-123');

  const userApi = new UserApi('https://api.example.com');
  await userApi.login('user@example.com', 'password');
  await userApi.getCurrentUser();
}

// Export examples for testing
export {
  getUserById,
  searchUsers,
  createUser,
  updateUser,
  updateUserEmail,
  deleteUser,
  getProtectedResource,
  getWithTimeout,
  useHttpServiceDirectly,
  useCustomHttpService,
  handleErrorsComprehensively,
  fetchWithRetry,
  NFTApi,
  UserApi,
  runExamples,
};

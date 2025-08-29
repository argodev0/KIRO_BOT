export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
    role: string;
    isVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  session?: {
    id: string;
    userId: string;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
    lastActivity: Date;
    expiresAt: Date;
    isActive: boolean;
    metadata?: Record<string, any>;
  };
  authMethod?: 'jwt' | 'session' | 'apikey';
  securityContext?: {
    ipAddress: string;
    userAgent: string;
    riskScore: number;
    isNewDevice: boolean;
    isSuspicious: boolean;
  };
}

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface MfaVerifyRequest {
  token: string;
  secret: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ApiKeyRequest {
  name: string;
  permissions: string[];
  expiresAt?: Date;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: Date;
  expiresAt?: Date;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  path: string;
  method: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum Permission {
  // Trading permissions
  TRADE_EXECUTE = 'trade:execute',
  TRADE_VIEW = 'trade:view',
  TRADE_CANCEL = 'trade:cancel',
  
  // Portfolio permissions
  PORTFOLIO_VIEW = 'portfolio:view',
  PORTFOLIO_MANAGE = 'portfolio:manage',
  
  // Grid trading permissions
  GRID_CREATE = 'grid:create',
  GRID_MANAGE = 'grid:manage',
  GRID_VIEW = 'grid:view',
  
  // Analytics permissions
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',
  
  // System permissions
  SYSTEM_MONITOR = 'system:monitor',
  SYSTEM_ADMIN = 'system:admin',
  
  // User management permissions
  USER_MANAGE = 'user:manage',
  USER_VIEW = 'user:view'
}
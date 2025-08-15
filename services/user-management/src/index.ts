import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '@finverse/shared-config';
import { createServiceLogger, ServiceBase } from '@finverse/shared-utils';
import { AppDataSource, User, initializeDatabase } from '@finverse/shared-database';
import { validateRequest } from './middleware/validation';
import { authSchemas } from './schemas/auth';

const logger = createServiceLogger('user-management');

class UserManagementService extends ServiceBase {
  private app: express.Application;
  private server: any;

  constructor() {
    super('user-management');
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  async initialize(): Promise<void> {
    try {
      await initializeDatabase();
      logger.info('✅ User Management Service initialized');
    } catch (error) {
      logger.error('❌ User Management Service initialization failed:', error);
      throw error;
    }
  }

  protected async cleanup(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
  }

  protected async performHealthCheck(): Promise<any> {
    try {
      await AppDataSource.query('SELECT 1');
      return {
        database: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };
    } catch (error) {
      throw new Error(`Health check failed: ${error.message}`);
    }
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors({
      origin: config.cors.origins,
      credentials: true,
    }));
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'user-management',
        timestamp: new Date().toISOString(),
      });
    });

    // Authentication routes
    this.app.post('/auth/register', validateRequest(authSchemas.register), this.handleRegister.bind(this));
    this.app.post('/auth/login', validateRequest(authSchemas.login), this.handleLogin.bind(this));
    this.app.post('/auth/refresh', validateRequest(authSchemas.refresh), this.handleRefreshToken.bind(this));
    this.app.post('/auth/logout', this.handleLogout.bind(this));

    // User routes
    this.app.get('/users/me', this.authenticateToken.bind(this), this.handleGetProfile.bind(this));

    // Error handling
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('User Management Error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        },
      });
    });
  }

  private async handleRegister(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName, phone, panNumber } = req.body;

      // Check if user already exists
      const existingUser = await AppDataSource.getRepository(User).findOne({
        where: { email },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email already exists',
          },
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

      // Create user
      const user = AppDataSource.getRepository(User).create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        panNumber,
        role: 'TRADER',
        isEmailVerified: false,
        isActive: true,
        permissions: [],
        preferences: {},
      });

      await AppDataSource.getRepository(User).save(user);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async handleLogin(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await AppDataSource.getRepository(User).findOne({
        where: { email },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Account has been disabled',
          },
        });
      }

      // Generate tokens
      const accessToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      const refreshToken = jwt.sign(
        {
          sub: user.id,
          type: 'refresh',
        },
        config.jwt.refreshSecret,
        { expiresIn: config.jwt.refreshExpiresIn }
      );

      // Update last login
      user.lastLoginAt = new Date();
      await AppDataSource.getRepository(User).save(user);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async handleRefreshToken(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid refresh token',
          },
        });
      }

      // Find user
      const user = await AppDataSource.getRepository(User).findOne({
        where: { id: decoded.sub },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found or inactive',
          },
        });
      }

      // Generate new access token
      const accessToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        success: true,
        data: {
          accessToken,
        },
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired refresh token',
          },
        });
      }
      next(error);
    }
  }

  private handleLogout(req: express.Request, res: express.Response): void {
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  private async authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Access token is required',
          },
        });
      }

      const decoded = jwt.verify(token, config.jwt.secret) as any;
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
        },
      });
    }
  }

  private async handleGetProfile(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
    try {
      const user = await AppDataSource.getRepository(User).findOne({
        where: { id: req.user.sub },
        select: ['id', 'email', 'firstName', 'lastName', 'phone', 'panNumber', 'role', 'isEmailVerified', 'createdAt'],
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  public async startServer(): Promise<void> {
    const port = 3001;
    
    this.server = this.app.listen(port, () => {
      logger.info(`✅ User Management Service running on port ${port}`);
    });
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Start the service
async function main() {
  const service = new UserManagementService();
  
  try {
    await service.start();
    await service.startServer();
  } catch (error) {
    logger.error('Failed to start User Management Service:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { UserManagementService };
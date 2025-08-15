import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';
import { validateRequest } from '../middleware/validation';
import { authLimiter } from '../middleware/rateLimiting';
import { redis } from '../utils/redis';
import { sendEmail } from '../utils/email';
import { generateOTP } from '../utils/otp';
import { config } from '../config';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/),
    aadhaarNumber: z.string().regex(/^\d{12}$/).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    mfaCode: z.string().optional(),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string(),
    password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  }),
});

// Register
router.post('/register', 
  authLimiter,
  validateRequest(registerSchema),
  async (req, res) => {
    try {
      const { email, password, firstName, lastName, phone, panNumber, aadhaarNumber } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists with this email',
          code: 'USER_EXISTS',
        });
      }

      // Check PAN number uniqueness
      const existingPAN = await User.findOne({ where: { panNumber } });
      if (existingPAN) {
        return res.status(409).json({
          error: 'User already exists with this PAN number',
          code: 'PAN_EXISTS',
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = await User.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        panNumber,
        aadhaarNumber,
        role: 'TRADER',
        isEmailVerified: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Generate email verification token
      const verificationToken = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwt.secret,
        { expiresIn: '24h' }
      );

      // Send verification email
      await sendEmail({
        to: email,
        subject: 'Verify your FinVerse account',
        template: 'email-verification',
        data: {
          firstName,
          verificationLink: `${config.frontend.url}/verify-email?token=${verificationToken}`,
        },
      });

      res.status(201).json({
        message: 'User registered successfully. Please check your email for verification.',
        userId: user.id,
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR',
      });
    }
  }
);

// Login
router.post('/login',
  authLimiter,
  validateRequest(loginSchema),
  async (req, res) => {
    try {
      const { email, password, mfaCode } = req.body;

      // Find user
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          error: 'Account is disabled',
          code: 'ACCOUNT_DISABLED',
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Check MFA if enabled
      if (user.mfaEnabled) {
        if (!mfaCode) {
          return res.status(200).json({
            message: 'MFA code required',
            requiresMFA: true,
          });
        }

        const storedMFACode = await redis.get(`mfa:${user.id}`);
        if (!storedMFACode || storedMFACode !== mfaCode) {
          return res.status(401).json({
            error: 'Invalid MFA code',
            code: 'INVALID_MFA_CODE',
          });
        }

        // Remove used MFA code
        await redis.del(`mfa:${user.id}`);
      }

      // Generate JWT tokens
      const accessToken = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          role: user.role,
        },
        config.jwt.secret,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        config.jwt.refreshSecret,
        { expiresIn: '7d' }
      );

      // Store user session in Redis
      await redis.setex(`session:${user.id}`, 15 * 60, JSON.stringify({
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      }));

      // Store refresh token
      await redis.setex(`refresh:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

      // Update last login
      await user.update({ lastLoginAt: new Date() });

      res.status(200).json({
        message: 'Login successful',
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
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR',
      });
    }
  }
);

// Logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token) as any;
      
      if (decoded && decoded.userId) {
        // Remove user session
        await redis.del(`session:${decoded.userId}`);
        await redis.del(`refresh:${decoded.userId}`);
        
        // Blacklist the token
        await redis.setex(`blacklist:${token}`, 15 * 60, 'true');
      }
    }

    res.status(200).json({
      message: 'Logout successful',
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR',
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN',
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;
    
    // Check if refresh token exists in Redis
    const storedToken = await redis.get(`refresh:${decoded.userId}`);
    if (!storedToken || storedToken !== refreshToken) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    // Get user
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'User not found or inactive',
        code: 'USER_NOT_FOUND',
      });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { 
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: '15m' }
    );

    // Update session in Redis
    await redis.setex(`session:${user.id}`, 15 * 60, JSON.stringify({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    }));

    res.status(200).json({
      accessToken,
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: 'Token refresh failed',
      code: 'TOKEN_REFRESH_ERROR',
    });
  }
});

// Forgot password
router.post('/forgot-password',
  authLimiter,
  validateRequest(forgotPasswordSchema),
  async (req, res) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        // Don't reveal if email exists
        return res.status(200).json({
          message: 'If an account with that email exists, a reset link has been sent.',
        });
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwt.secret,
        { expiresIn: '1h' }
      );

      // Store reset token in Redis
      await redis.setex(`reset:${user.id}`, 60 * 60, resetToken);

      // Send reset email
      await sendEmail({
        to: email,
        subject: 'Reset your FinVerse password',
        template: 'password-reset',
        data: {
          firstName: user.firstName,
          resetLink: `${config.frontend.url}/reset-password?token=${resetToken}`,
        },
      });

      res.status(200).json({
        message: 'If an account with that email exists, a reset link has been sent.',
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        error: 'Failed to process password reset request',
        code: 'PASSWORD_RESET_ERROR',
      });
    }
  }
);

// Reset password
router.post('/reset-password',
  authLimiter,
  validateRequest(resetPasswordSchema),
  async (req, res) => {
    try {
      const { token, password } = req.body;

      // Verify reset token
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      // Check if reset token exists in Redis
      const storedToken = await redis.get(`reset:${decoded.userId}`);
      if (!storedToken || storedToken !== token) {
        return res.status(401).json({
          error: 'Invalid or expired reset token',
          code: 'INVALID_RESET_TOKEN',
        });
      }

      // Get user
      const user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Update password
      await user.update({ 
        password: hashedPassword,
        updatedAt: new Date(),
      });

      // Remove reset token
      await redis.del(`reset:${decoded.userId}`);

      // Invalidate all user sessions
      await redis.del(`session:${user.id}`);
      await redis.del(`refresh:${user.id}`);

      res.status(200).json({
        message: 'Password reset successful',
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        error: 'Password reset failed',
        code: 'PASSWORD_RESET_ERROR',
      });
    }
  }
);

export { router as authRoutes };
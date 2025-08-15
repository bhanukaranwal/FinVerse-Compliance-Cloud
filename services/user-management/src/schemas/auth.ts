import { z } from 'zod';

export const authSchemas = {
  register: {
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
      lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
      phone: z.string().optional(),
      panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number format'),
      agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms and conditions'),
    }),
  },

  login: {
    body: z.object({
      email: z.string().email('Invalid email address'),
      password: z.string().min(1, 'Password is required'),
      mfaCode: z.string().optional(),
      rememberMe: z.boolean().optional(),
    }),
  },

  refresh: {
    body: z.object({
      refreshToken: z.string().min(1, 'Refresh token is required'),
    }),
  },
};
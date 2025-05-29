import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body } from 'express-validator';

export function createAuthRoutes(): Router {
  const router = Router();

  // Login with wallet signature
  router.post(
    '/login',
    validateRequest([
      body('wallet').isString().matches(/^0x[a-fA-F0-9]{64}$/),
      body('signature').isString().notEmpty(),
      body('message').isString().notEmpty(),
    ]),
    authController.login
  );

  // Verify JWT token
  router.post(
    '/verify',
    authenticateJWT,
    authController.verify
  );

  // Refresh JWT token
  router.post(
    '/refresh',
    validateRequest([
      body('refreshToken').isString().notEmpty(),
    ]),
    authController.refresh
  );

  // Logout (invalidate token)
  router.post(
    '/logout',
    authenticateJWT,
    authController.logout
  );

  return router;
}
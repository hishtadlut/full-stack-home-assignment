import express from 'express';
import {
  getMe,
  login,
  logout,
  logoutAllDevices,
  refresh,
  register,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateLogin, validateRegister } from '../middleware/authValidation';
import { requireJsonObjectBody } from '../middleware/validation';

const router = express.Router();

router.post('/register', requireJsonObjectBody, validateRegister, register);
router.post('/login', requireJsonObjectBody, validateLogin, login);
router.post('/refresh', refresh);
router.delete('/refresh', logout);
router.post('/logout-all', authenticate, logoutAllDevices);
router.get('/me', authenticate, getMe);

export default router;

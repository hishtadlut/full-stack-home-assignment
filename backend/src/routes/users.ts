import express from 'express';
import { listUsers } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticate, listUsers);

export default router;

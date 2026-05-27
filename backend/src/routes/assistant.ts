import express from 'express';
import {
  createChat,
  getChat,
  listChats,
  sendMessage,
  updateDraft,
} from '../controllers/assistantController';
import { authenticate } from '../middleware/auth';
import { requireJsonObjectBody } from '../middleware/validation';

const router = express.Router();

router.get('/chats', authenticate, listChats);
router.post('/chats', authenticate, createChat);
router.get('/chats/:chatId', authenticate, getChat);
router.post('/chats/:chatId/messages', authenticate, requireJsonObjectBody, sendMessage);
router.patch('/drafts/:draftId', authenticate, requireJsonObjectBody, updateDraft);

export default router;

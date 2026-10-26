import express from 'express';
import HttpError from '../class/HttpError.js';
import { getMe, login, register } from '../controllers/auth.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

// La validation (zod) est faite dans les contrôleurs : les routes passent le body brut.
router.post('/register', async (req, res) => {
  try {
    return res.status(201).json(await register(req.body));
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot register. Please try again');
  }
});

router.post('/login', async (req, res) => {
  try {
    return res.status(200).json(await login(req.body));
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot login. Please try again');
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    return res.status(200).json(await getMe(req.userId!));
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot get user. Please try again');
  }
});

export default router;

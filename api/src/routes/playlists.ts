import express from 'express';
import HttpError from '../class/HttpError.js';
import {
  addVideoToPlaylist,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  removeVideoFromPlaylist,
  renamePlaylist,
} from '../controllers/playlists.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

// Toutes les routes sont protégées ; le userId vient du JWT (req.userId), jamais du client.
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    return res.status(200).json(await listPlaylists(req.userId!));
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot list playlists. Please try again');
  }
});

router.post('/', async (req, res) => {
  try {
    return res.status(201).json(await createPlaylist(req.userId!, req.body));
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot create playlist. Please try again');
  }
});

router.patch('/:id', async (req, res) => {
  try {
    return res.status(200).json(await renamePlaylist(req.userId!, req.params.id, req.body));
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot rename playlist. Please try again');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deletePlaylist(req.userId!, req.params.id);
    return res.status(204).end();
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot delete playlist. Please try again');
  }
});

router.post('/:id/videos', async (req, res) => {
  try {
    return res.status(201).json(await addVideoToPlaylist(req.userId!, req.params.id, req.body));
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot add video. Please try again');
  }
});

router.delete('/:id/videos/:videoId', async (req, res) => {
  try {
    await removeVideoFromPlaylist(req.userId!, req.params.id, req.params.videoId);
    return res.status(204).end();
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot remove video. Please try again');
  }
});

export default router;

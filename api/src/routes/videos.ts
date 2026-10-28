import express from 'express';
import HttpError from '../class/HttpError.js';
import { getVideo, searchVideos } from '../controllers/videos.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = express.Router();

// Toutes les routes vidéos sont protégées (le fournisseur YouTube consomme du quota).
router.use(requireAuth);

// `/search` doit rester déclarée avant `/:id`, sinon « search » serait pris pour un ID.
router.get('/search', async (req, res) => {
  try {
    return res.status(200).json(await searchVideos(req.query));
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot search videos. Please try again');
  }
});

router.get('/:id', async (req, res) => {
  try {
    return res.status(200).json(await getVideo(req.params.id));
  } catch (error) {
    return HttpError.handle(error, res, 'Cannot get video. Please try again');
  }
});

export default router;

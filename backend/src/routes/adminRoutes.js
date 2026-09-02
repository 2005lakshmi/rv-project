const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
  getDashboardStatsController,
  getUsersController,
  getUserByIdController,
  updateUserController,
  deleteUserController,
} = require('../controllers/adminController');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.get('/dashboard/stats', getDashboardStatsController);
router.get('/users', getUsersController);
router.get('/users/:id', getUserByIdController);
router.put('/users/:id', updateUserController);
router.delete('/users/:id', deleteUserController);

module.exports = router;

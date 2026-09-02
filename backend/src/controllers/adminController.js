const { getDashboardStats, listUsers, findUserById, updateUserById, deleteUserById } = require('../services/authService');

async function getDashboardStatsController(req, res) {
  try {
    const stats = await getDashboardStats();
    return res.status(200).json({
      success: true,
      message: 'Dashboard statistics fetched successfully.',
      data: stats,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to fetch dashboard stats.',
    });
  }
}

async function getUsersController(req, res) {
  try {
    const users = await listUsers();
    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Unable to fetch users.',
    });
  }
}

async function getUserByIdController(req, res) {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Unable to fetch user.' });
  }
}

async function updateUserController(req, res) {
  try {
    const updated = await updateUserById(req.params.id, req.body);
    return res.status(200).json({ success: true, message: 'User updated successfully.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Unable to update user.' });
  }
}

async function deleteUserController(req, res) {
  try {
    const deleted = await deleteUserById(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Unable to delete user.' });
  }
}

module.exports = {
  getDashboardStatsController,
  getUsersController,
  getUserByIdController,
  updateUserController,
  deleteUserController,
};

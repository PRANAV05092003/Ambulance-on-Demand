const express = require('express');
const { check } = require('express-validator');
const emergencyController = require('../controllers/emergencyController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// @route   POST /api/emergency
// @desc    Create a new emergency request
// @access  Private
router.post(
  '/',
  [
    check('location.coordinates', 'Location coordinates are required').isArray({ min: 2, max: 2 }),
    check('location.address', 'Location address is required').not().isEmpty(),
    check('medicalInfo.condition', 'Medical condition is required').not().isEmpty(),
    check('priority', 'Priority must be Low, Medium, High, or Critical').isIn(['Low', 'Medium', 'High', 'Critical'])
  ],
  emergencyController.createEmergency
);

// @route   GET /api/emergency/:id
// @desc    Get emergency by ID
// @access  Private
router.get('/:id', emergencyController.getEmergencyById);

// @route   PUT /api/emergency/:id/status
// @desc    Update emergency status
// @access  Private
router.put(
  '/:id/status',
  [
    check('status', 'Status is required').not().isEmpty(),
    check('status').isIn(['Pending', 'Dispatched', 'In Transit', 'Completed', 'Cancelled'])
  ],
  emergencyController.updateEmergencyStatus
);

// @route   GET /api/emergency/hospital/:hospitalId
// @desc    Get emergencies for a hospital
// @access  Private/Hospital Admin
router.get(
  '/hospital/:hospitalId',
  authorize('hospital_admin', 'admin'),
  emergencyController.getHospitalEmergencies
);

// @route   GET /api/emergency/user/:userId?
// @desc    Get emergencies for a user
// @access  Private
router.get('/user/:userId?', emergencyController.getUserEmergencies);

module.exports = router;

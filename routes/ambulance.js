const express = require('express');
const { check } = require('express-validator');
const ambulanceController = require('../controllers/ambulanceController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// @route   GET /api/ambulance
// @desc    Get all ambulances
// @access  Private/Admin
router.get('/', authorize('admin'), ambulanceController.getAllAmbulances);

// @route   GET /api/ambulance/hospital/:hospitalId
// @desc    Get ambulances by hospital
// @access  Private/Hospital Admin
router.get(
  '/hospital/:hospitalId',
  authorize('hospital_admin', 'admin'),
  ambulanceController.getAmbulancesByHospital
);

// @route   GET /api/ambulance/:id
// @desc    Get ambulance by ID
// @access  Private
router.get('/:id', ambulanceController.getAmbulanceById);

// @route   POST /api/ambulance
// @desc    Create new ambulance
// @access  Private/Admin
router.post(
  '/',
  authorize('admin', 'hospital_admin'),
  [
    check('vehicleNumber', 'Vehicle number is required').not().isEmpty(),
    check('model', 'Model is required').not().isEmpty(),
    check('type', 'Type must be Basic, Advanced, Mobile ICU, or Neonatal')
      .isIn(['Basic', 'Advanced', 'Mobile ICU', 'Neonatal']),
    check('capacity', 'Capacity must be a number greater than 0').isInt({ min: 1 }),
    check('driver', 'Driver ID is required').not().isEmpty(),
    check('hospital', 'Hospital ID is required').not().isEmpty()
  ],
  ambulanceController.createAmbulance
);

// @route   PUT /api/ambulance/:id
// @desc    Update ambulance
// @access  Private/Admin
router.put(
  '/:id',
  authorize('admin', 'hospital_admin'),
  [
    check('type', 'Type must be Basic, Advanced, Mobile ICU, or Neonatal')
      .optional()
      .isIn(['Basic', 'Advanced', 'Mobile ICU', 'Neonatal']),
    check('capacity', 'Capacity must be a number greater than 0')
      .optional()
      .isInt({ min: 1 }),
    check('status')
      .optional()
      .isIn(['Available', 'On Duty', 'In Maintenance', 'Unavailable'])
  ],
  ambulanceController.updateAmbulance
);

// @route   PUT /api/ambulance/:id/location
// @desc    Update ambulance location
// @access  Private/Driver
router.put(
  '/:id/location',
  authorize('driver'),
  [
    check('coordinates', 'Coordinates are required').isArray({ min: 2, max: 2 }),
    check('address', 'Address is required').not().isEmpty()
  ],
  ambulanceController.updateAmbulanceLocation
);

// @route   GET /api/ambulance/:id/emergency
// @desc    Get active emergency for ambulance
// @access  Private/Driver
router.get(
  '/:id/emergency',
  authorize('driver'),
  ambulanceController.getAmbulanceEmergency
);

module.exports = router;

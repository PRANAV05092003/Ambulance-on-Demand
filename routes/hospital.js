const express = require('express');
const { check } = require('express-validator');
const hospitalController = require('../controllers/hospitalController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// @route   GET /api/hospital
// @desc    Get all hospitals
// @access  Public
router.get('/', hospitalController.getAllHospitals);

// @route   GET /api/hospital/nearest
// @desc    Get nearest hospitals
// @access  Public
router.get(
  '/nearest',
  [
    check('lat', 'Latitude is required').isFloat({ min: -90, max: 90 }),
    check('lng', 'Longitude is required').isFloat({ min: -180, max: 180 }),
    check('maxDistance', 'Max distance must be a number').optional().isInt({ min: 1 })
  ],
  hospitalController.getNearestHospitals
);

// @route   GET /api/hospital/:id
// @desc    Get hospital by ID
// @access  Public
router.get('/:id', hospitalController.getHospitalById);

// @route   POST /api/hospital
// @desc    Create new hospital
// @access  Private/Admin
router.post(
  '/',
  authorize('admin'),
  [
    check('name', 'Name is required').not().isEmpty(),
    check('registrationNumber', 'Registration number is required').not().isEmpty(),
    check('contact.email', 'Please include a valid email').isEmail(),
    check('contact.phone', 'Please include a valid phone number').matches(/^[0-9]{10,15}$/),
    check('address.street', 'Street address is required').not().isEmpty(),
    check('address.city', 'City is required').not().isEmpty(),
    check('address.state', 'State is required').not().isEmpty(),
    check('address.postalCode', 'Postal code is required').not().isEmpty(),
    check('address.location.coordinates', 'Location coordinates are required').isArray({ min: 2, max: 2 }),
    check('admin', 'Admin user ID is required').not().isEmpty()
  ],
  hospitalController.createHospital
);

// @route   PUT /api/hospital/:id
// @desc    Update hospital
// @access  Private/Admin
router.put(
  '/:id',
  authorize('admin', 'hospital_admin'),
  [
    check('contact.email', 'Please include a valid email').optional().isEmail(),
    check('contact.phone', 'Please include a valid phone number').optional().matches(/^[0-9]{10,15}$/)
  ],
  hospitalController.updateHospital
);

// @route   DELETE /api/hospital/:id
// @desc    Delete hospital
// @access  Private/Admin
router.delete('/:id', authorize('admin'), hospitalController.deleteHospital);

// @route   GET /api/hospital/:id/ambulances
// @desc    Get ambulances for hospital
// @access  Private/Hospital Admin
router.get(
  '/:id/ambulances',
  authorize('hospital_admin', 'admin'),
  hospitalController.getHospitalAmbulances
);

// @route   GET /api/hospital/:id/emergencies
// @desc    Get emergencies for hospital
// @access  Private/Hospital Admin
router.get(
  '/:id/emergencies',
  authorize('hospital_admin', 'admin'),
  hospitalController.getHospitalEmergencies
);

// @route   POST /api/hospital/:id/staff
// @desc    Add staff to hospital
// @access  Private/Hospital Admin
router.post(
  '/:id/staff',
  authorize('hospital_admin', 'admin'),
  [
    check('userId', 'User ID is required').not().isEmpty(),
    check('role', 'Role is required').isIn(['doctor', 'nurse', 'staff', 'admin']),
    check('department', 'Department is required').not().isEmpty()
  ],
  hospitalController.addStaff
);

// @route   PUT /api/hospital/:id/staff/:staffId
// @desc    Update hospital staff
// @access  Private/Hospital Admin
router.put(
  '/:id/staff/:staffId',
  authorize('hospital_admin', 'admin'),
  [
    check('role').optional().isIn(['doctor', 'nurse', 'staff', 'admin']),
    check('isActive').optional().isBoolean()
  ],
  hospitalController.updateStaff
);

// @route   DELETE /api/hospital/:id/staff/:staffId
// @desc    Remove staff from hospital
// @access  Private/Hospital Admin
router.delete(
  '/:id/staff/:staffId',
  authorize('hospital_admin', 'admin'),
  hospitalController.removeStaff
);

module.exports = router;

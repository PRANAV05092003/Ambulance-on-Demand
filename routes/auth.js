const express = require('express');
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
    check('phone', 'Please include a valid phone number').matches(/^[0-9]{10,15}$/)
  ],
  authController.register
);

// @route   POST /api/auth/login
// @desc    Auth user & get token
// @access  Public
router.post(
  '/login',
  [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists()
  ],
  authController.login
);

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', protect, authController.getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put(
  '/profile',
  protect,
  [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('phone', 'Please include a valid phone number').matches(/^[0-9]{10,15}$/)
  ],
  authController.updateProfile
);

// @route   GET /api/auth/verify-email/:token
// @desc    Verify email
// @access  Public
router.get('/verify-email/:token', authController.verifyEmail);

// @route   POST /api/auth/forgot-password
// @desc    Forgot password
// @access  Public
router.post(
  '/forgot-password',
  [check('email', 'Please include a valid email').isEmail()],
  authController.forgotPassword
);

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password
// @access  Public
router.post(
  '/reset-password/:token',
  [
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ],
  authController.resetPassword
);

module.exports = router;

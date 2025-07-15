const { validationResult } = require('express-validator');

/**
 * Middleware to validate request using express-validator
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Middleware to validate MongoDB ObjectId
 * @param {string} idParam - Name of the ID parameter in the request
 * @returns {Function} Express middleware function
 */
const validateObjectId = (idParam) => {
  return (req, res, next) => {
    const id = req.params[idParam];
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format',
        field: idParam,
        value: id
      });
    }
    next();
  };
};

/**
 * Middleware to validate pagination parameters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  
  if (page < 1) {
    return res.status(400).json({
      success: false,
      message: 'Page number must be greater than 0',
      field: 'page',
      value: page
    });
  }
  
  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100',
      field: 'limit',
      value: limit
    });
  }
  
  req.pagination = { page, limit };
  next();
};

/**
 * Middleware to validate location coordinates
 * @param {string} locationParam - Name of the location parameter in the request
 * @returns {Function} Express middleware function
 */
const validateLocation = (locationParam) => {
  return (req, res, next) => {
    const location = req.body[locationParam];
    
    if (!location || !location.coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates are required',
        field: `${locationParam}.coordinates`
      });
    }
    
    const [lng, lat] = location.coordinates;
    
    if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be a number between -90 and 90',
        field: `${locationParam}.coordinates[1]`,
        value: lat
      });
    }
    
    if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Longitude must be a number between -180 and 180',
        field: `${locationParam}.coordinates[0]`,
        value: lng
      });
    }
    
    next();
  };
};

/**
 * Middleware to validate phone number format
 * @param {string} phoneParam - Name of the phone parameter in the request
 * @returns {Function} Express middleware function
 */
const validatePhone = (phoneParam) => {
  return (req, res, next) => {
    const phone = req.body[phoneParam];
    
    if (!phone) {
      return next();
    }
    
    // Simple phone number validation (10-15 digits, optional + prefix)
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (10-15 digits)',
        field: phoneParam,
        value: phone
      });
    }
    
    next();
  };
};

/**
 * Middleware to validate email format
 * @param {string} emailParam - Name of the email parameter in the request
 * @returns {Function} Express middleware function
 */
const validateEmail = (emailParam) => {
  return (req, res, next) => {
    const email = req.body[emailParam];
    
    if (!email) {
      return next();
    }
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
        field: emailParam,
        value: email
      });
    }
    
    next();
  };
};

/**
 * Middleware to validate date format
 * @param {string} dateParam - Name of the date parameter in the request
 * @param {string} format - Expected date format (e.g., 'YYYY-MM-DD')
 * @returns {Function} Express middleware function
 */
const validateDate = (dateParam, format = 'YYYY-MM-DD') => {
  return (req, res, next) => {
    const dateStr = req.body[dateParam];
    
    if (!dateStr) {
      return next();
    }
    
    let isValid = false;
    
    switch (format) {
      case 'YYYY-MM-DD':
        isValid = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
        break;
      case 'ISO':
        isValid = !isNaN(Date.parse(dateStr));
        break;
      // Add more formats as needed
      default:
        isValid = !isNaN(Date.parse(dateStr));
    }
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: `Date must be in ${format} format`,
        field: dateParam,
        value: dateStr
      });
    }
    
    next();
  };
};

module.exports = {
  validate,
  validateObjectId,
  validatePagination,
  validateLocation,
  validatePhone,
  validateEmail,
  validateDate
};

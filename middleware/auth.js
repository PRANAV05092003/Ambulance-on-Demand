const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @desc    Protect routes
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// @desc    Authorize roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// @desc    Check if user is the owner of the resource
const checkOwnership = (model, paramName = 'id') => {
  return async (req, res, next) => {
    try {
      const resource = await model.findById(req.params[paramName]);
      
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
      }
      
      // If user is admin or hospital admin, allow access
      if (req.user.role === 'admin' || req.user.role === 'hospital_admin') {
        return next();
      }
      
      // Check if user is the owner of the resource
      if (resource.user && resource.user.toString() !== req.user.id) {
        return res.status(403).json({ 
          message: 'Not authorized to access this resource' 
        });
      }
      
      // For ambulance, check if user is the driver
      if (model.modelName === 'Ambulance' && resource.driver.toString() !== req.user.id) {
        return res.status(403).json({ 
          message: 'Not authorized to access this ambulance' 
        });
      }
      
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ message: 'Server error during ownership check' });
    }
  };
};

module.exports = { protect, authorize, checkOwnership };

const rateLimit = require('express-rate-limit');
const { logWarning } = require('../utils/logger');

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    logWarning('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      headers: req.headers
    });
    res.status(options.statusCode).json(options.message);
  }
});

// More aggressive rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again after an hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logWarning('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(options.statusCode).json(options.message);
  }
});

module.exports = {
  apiLimiter,
  authLimiter
};

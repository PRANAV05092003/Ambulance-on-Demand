const { logError, logErrorToFile } = require('../utils/logger');

/**
 * Error response object structure
 * @param {Error} err - Error object
 * @returns {Object} Formatted error response
 */
const errorResponse = (err) => {
  // Default error response
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
    code: err.code || 500,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation error
    response.message = 'Validation Error';
    response.code = 400;
    response.errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value
    }));
  } else if (err.name === 'MongoError' && err.code === 11000) {
    // MongoDB duplicate key error
    const field = Object.keys(err.keyPattern)[0];
    response.message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    response.code = 400;
    response.errors = [{
      field,
      message: response.message,
      value: err.keyValue[field]
    }];
  } else if (err.name === 'JsonWebTokenError') {
    // JWT error
    response.message = 'Invalid or expired token';
    response.code = 401;
  } else if (err.name === 'TokenExpiredError') {
    // JWT expired error
    response.message = 'Token has expired';
    response.code = 401;
  } else if (err.name === 'UnauthorizedError') {
    // Authentication error
    response.message = 'Not authorized to access this resource';
    response.code = 401;
  } else if (err.name === 'NotFoundError') {
    // Resource not found error
    response.message = err.message || 'Resource not found';
    response.code = 404;
  } else if (err.name === 'BadRequestError') {
    // Bad request error
    response.message = err.message || 'Bad request';
    response.code = 400;
  } else if (err.name === 'ForbiddenError') {
    // Forbidden error
    response.message = err.message || 'Access denied';
    response.code = 403;
  }

  return response;
};

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logError(err);
  
  // Log to file in production
  if (process.env.NODE_ENV === 'production') {
    logErrorToFile(err, req);
  }

  // Get error response
  const error = errorResponse(err);

  // Set response status code
  res.status(error.code || 500);

  // Send error response
  res.json({
    success: false,
    message: error.message,
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      ...(error.errors && { errors: error.errors })
    })
  });
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.name = 'NotFoundError';
  error.code = 404;
  next(error);
};

/**
 * Async handler to wrap async/await route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom error classes for better error handling
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = statusCode || 500;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError
};

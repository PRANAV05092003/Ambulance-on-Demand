const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;
const path = require('path');
const fs = require('fs');
const { format: dateFnsFormat, parseISO } = require('date-fns');

// Ensure logs directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  
  if (stack) {
    log += '\n' + stack;
  }
  
  if (Object.keys(meta).length > 0) {
    log += '\n' + JSON.stringify(meta, null, 2);
  }
  
  return log;
});

// Format for file output
const fileFormat = combine(
  timestamp(),
  json()
);

// Create logger instance
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat()
  ),
  defaultMeta: { service: 'ambulance-on-demand' },
  transports: [
    // Console transport for development
    new transports.Console({
      format: combine(
        colorize(),
        consoleFormat
      )
    }),
    // Error logs
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 30,
      tailable: true,
      zippedArchive: true
    }),
    // Combined logs
    new transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 30,
      tailable: true,
      zippedArchive: true
    })
  ],
  exitOnError: false
});

// Create a stream for morgan (HTTP request logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

/**
 * Log an error with context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
const logError = (error, context = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context
  });
};

/**
 * Log an info message with context
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
const logInfo = (message, context = {}) => {
  logger.info(message, context);
};

/**
 * Log a warning with context
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
const logWarning = (message, context = {}) => {
  logger.warn(message, context);
};

/**
 * Log a debug message with context
 * @param {string} message - Debug message
 * @param {Object} context - Additional context
 */
const logDebug = (message, context = {}) => {
  logger.debug(message, context);
};

/**
 * Log an HTTP request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} error - Optional error object
 */
const logHttpRequest = (req, res, error = null) => {
  const { method, originalUrl, ip, headers, body, params, query, user } = req;
  const responseTime = res.getHeader('X-Response-Time');
  
  const logData = {
    method,
    url: originalUrl,
    ip,
    statusCode: res.statusCode,
    responseTime,
    userAgent: headers['user-agent'],
    userId: user?._id,
    error: error ? error.message : undefined,
    stack: error?.stack,
    // Be careful with logging sensitive data in production
    ...(process.env.NODE_ENV !== 'production' && {
      params,
      query,
      // Don't log password fields
      body: Object.keys(body).reduce((acc, key) => {
        if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
          acc[key] = '***REDACTED***';
        } else {
          acc[key] = body[key];
        }
        return acc;
      }, {})
    })
  };
  
  if (error) {
    logError(error, logData);
  } else if (res.statusCode >= 400) {
    logWarning('HTTP Request Error', logData);
  } else {
    logInfo('HTTP Request', logData);
  }
};

/**
 * Log an error to a separate error log file with request details
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 */
const logErrorToFile = (error, req) => {
  const timestamp = dateFnsFormat(new Date(), 'yyyy-MM-dd');
  const errorLogPath = path.join(logDir, `error-${timestamp}.log`);
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: error.message,
    stack: error.stack,
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      user: req.user?._id,
      params: req.params,
      query: req.query,
      // Don't log sensitive data
      body: Object.keys(req.body).reduce((acc, key) => {
        if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
          acc[key] = '***REDACTED***';
        } else {
          acc[key] = req.body[key];
        }
        return acc;
      }, {})
    }
  };
  
  // Append to error log file
  fs.appendFileSync(errorLogPath, JSON.stringify(logEntry) + '\n');
};

module.exports = {
  logger,
  logError,
  logInfo,
  logWarning,
  logDebug,
  logHttpRequest,
  logErrorToFile
};

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { promisify } = require('util');
const { google } = require('google-maps-services-js');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the random string
 * @returns {string} Random string
 */
const generateRandomString = (length = 10) => {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};

/**
 * Generate a random numeric OTP
 * @param {number} length - Length of the OTP
 * @returns {string} Random numeric OTP
 */
const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  
  return otp;
};

/**
 * Hash a string using SHA-256
 * @param {string} text - Text to hash
 * @returns {string} Hashed string
 */
const hashString = (text) => {
  return crypto
    .createHash('sha256')
    .update(text)
    .digest('hex');
};

/**
 * Calculate distance between two coordinates in kilometers (Haversine formula)
 * @param {Object} coord1 - First coordinate { lat, lng }
 * @param {Object} coord2 - Second coordinate { lat, lng }
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (coord1, coord2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  
  return distance;
};

/**
 * Convert degrees to radians
 * @param {number} degrees - Value in degrees
 * @returns {number} Value in radians
 */
const toRad = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Format a date to a readable string
 * @param {Date} date - Date object
 * @param {string} format - Output format (default: 'en-US')
 * @returns {string} Formatted date string
 */
const formatDate = (date, format = 'en-US') => {
  return new Intl.DateTimeFormat(format, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(date));
};

/**
 * Format a duration in milliseconds to a human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2h 30m")
 */
const formatDuration = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

/**
 * Get the estimated time of arrival (ETA) based on distance and average speed
 * @param {number} distance - Distance in kilometers
 * @param {number} speed - Average speed in km/h (default: 40 km/h for city driving)
 * @returns {Object} ETA information { duration: number, arrivalTime: Date }
 */
const calculateETA = (distance, speed = 40) => {
  const duration = (distance / speed) * 60 * 60 * 1000; // Convert to milliseconds
  const arrivalTime = new Date(Date.now() + duration);
  
  return {
    duration,
    arrivalTime,
    formattedDuration: formatDuration(duration),
    formattedArrivalTime: formatDate(arrivalTime)
  };
};

/**
 * Calculate the fastest route using Google Maps Directions API
 * @param {Object} origin - Origin coordinates { lat, lng }
 * @param {Object} destination - Destination coordinates { lat, lng }
 * @returns {Promise<Object>} Route information
 */
const getFastestRoute = async (origin, destination) => {
  try {
    const client = new google.maps.Client({});
    
    const response = await client.directions({
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        key: process.env.GOOGLE_MAPS_API_KEY,
        mode: 'driving',
        traffic_model: 'best_guess',
        departure_time: 'now'
      },
      timeout: 1000 // 1 second timeout
    });
    
    if (response.data.status !== 'OK') {
      throw new Error(`Google Maps API error: ${response.data.status}`);
    }
    
    const route = response.data.routes[0];
    const leg = route.legs[0];
    
    return {
      distance: leg.distance.value / 1000, // Convert to km
      duration: leg.duration.value * 1000, // Convert to ms
      durationInTraffic: leg.duration_in_traffic?.value * 1000 || null,
      startAddress: leg.start_address,
      endAddress: leg.end_address,
      steps: leg.steps.map(step => ({
        distance: step.distance.value / 1000,
        duration: step.duration.value * 1000,
        instructions: step.html_instructions,
        travelMode: step.travel_mode,
        polyline: step.polyline.points
      })),
      polyline: route.overview_polyline.points
    };
  } catch (error) {
    console.error('Error getting directions:', error);
    throw error;
  }
};

/**
 * Generate a slug from a string
 * @param {string} text - Text to convert to slug
 * @returns {string} Slugified string
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
};

/**
 * Truncate a string to a specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to add if truncated (default: '...')
 * @returns {string} Truncated string
 */
const truncate = (text, length = 100, suffix = '...') => {
  if (text.length <= length) return text;
  return text.substring(0, length) + suffix;
};

/**
 * Validate an email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid, false otherwise
 */
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

/**
 * Validate a phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid, false otherwise
 */
const isValidPhone = (phone) => {
  const re = /^\+?[0-9]{10,15}$/;
  return re.test(phone);
};

/**
 * Format a phone number to E.164 format
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  const cleaned = ('' + phone).replace(/\D/g, '');
  
  // Check if the number starts with a country code
  if (cleaned.length > 10) {
    // Already has country code, add + if missing
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }
  
  // Default to US number with +1 country code
  return `+1${cleaned}`;
};

/**
 * Convert a file to base64 encoding
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} Base64 encoded string
 */
const fileToBase64 = async (filePath) => {
  try {
    const data = await readFile(filePath);
    return `data:${getMimeType(filePath)};base64,${data.toString('base64')}`;
  } catch (error) {
    console.error('Error converting file to base64:', error);
    throw error;
  }
};

/**
 * Get MIME type from file extension
 * @param {string} filename - File name or path
 * @returns {string} MIME type
 */
const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
    '.json': 'application/json'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
};

module.exports = {
  generateRandomString,
  generateOTP,
  hashString,
  calculateDistance,
  formatDate,
  formatDuration,
  calculateETA,
  getFastestRoute,
  slugify,
  truncate,
  isValidEmail,
  isValidPhone,
  formatPhoneNumber,
  fileToBase64,
  getMimeType
};

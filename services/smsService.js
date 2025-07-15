const twilio = require('twilio');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Read SMS templates
const templates = {
  emergencyAlert: fs.readFileSync(path.join(__dirname, '../templates/sms/emergency-alert.ejs'), 'utf8'),
  statusUpdate: fs.readFileSync(path.join(__dirname, '../templates/sms/status-update.ejs'), 'utf8'),
  otp: fs.readFileSync(path.join(__dirname, '../templates/sms/otp.ejs'), 'utf8')
};

// Compile templates
const compiledTemplates = {
  emergencyAlert: ejs.compile(templates.emergencyAlert),
  statusUpdate: ejs.compile(templates.statusUpdate),
  otp: ejs.compile(templates.otp)
};

/**
 * Send emergency alert SMS to contacts
 * @param {Object} options - Alert options
 * @param {string} options.patientName - Name of the patient
 * @param {Array} options.contacts - Array of contact objects {name, phone, relationship}
 * @param {Object} options.location - Emergency location {address, coordinates}
 * @param {string} options.emergencyId - Emergency ID for tracking
 * @returns {Promise}
 */
const sendEmergencyAlert = async ({ patientName, contacts, location, emergencyId }) => {
  try {
    if (!process.env.TWILIO_ENABLED === 'true') {
      console.log('Twilio is disabled. SMS alerts will not be sent.');
      return [];
    }

    const trackingUrl = `${process.env.FRONTEND_URL}/track-emergency/${emergencyId}`;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    const sendPromises = contacts.map(async (contact) => {
      if (!contact.phone) return null;
      
      const message = compiledTemplates.emergencyAlert({
        patientName,
        contactName: contact.name || 'there',
        location: location.address,
        relationship: contact.relationship || 'loved one',
        trackingUrl
      });
      
      try {
        const result = await client.messages.create({
          body: message,
          from: fromNumber,
          to: contact.phone
        });
        
        console.log(`Emergency SMS sent to ${contact.phone}: ${result.sid}`);
        return { success: true, sid: result.sid, to: contact.phone };
      } catch (error) {
        console.error(`Error sending SMS to ${contact.phone}:`, error.message);
        return { success: false, error: error.message, to: contact.phone };
      }
    });
    
    const results = await Promise.all(sendPromises);
    return results.filter(result => result !== null);
  } catch (error) {
    console.error('Error in sendEmergencyAlert:', error);
    throw new Error('Failed to send emergency SMS alerts');
  }
};

/**
 * Send status update SMS
 * @param {Object} options - Status update options
 * @param {string} options.to - Recipient phone number
 * @param {string} options.patientName - Name of the patient
 * @param {string} options.status - Current status
 * @param {string} options.ambulanceNumber - Ambulance number
 * @param {string} options.driverName - Driver name
 * @param {string} options.eta - Estimated time of arrival
 * @returns {Promise}
 */
const sendStatusUpdate = async ({ to, patientName, status, ambulanceNumber, driverName, eta }) => {
  try {
    if (!process.env.TWILIO_ENABLED === 'true') {
      console.log('Twilio is disabled. SMS status updates will not be sent.');
      return null;
    }

    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    const message = compiledTemplates.statusUpdate({
      patientName,
      status,
      ambulanceNumber,
      driverName,
      eta
    });
    
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to
    });
    
    console.log(`Status update SMS sent to ${to}: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error(`Error sending status update SMS to ${to}:`, error.message);
    throw new Error('Failed to send status update SMS');
  }
};

/**
 * Send OTP via SMS
 * @param {string} to - Recipient phone number
 * @param {string} otp - One-time password
 * @param {string} purpose - Purpose of the OTP (e.g., 'verification', 'password_reset')
 * @returns {Promise}
 */
const sendOTP = async (to, otp, purpose = 'verification') => {
  try {
    if (!process.env.TWILIO_ENABLED === 'true') {
      console.log('Twilio is disabled. OTP SMS will not be sent.');
      return { success: true, message: 'Development mode: OTP SMS would be sent in production' };
    }

    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    const message = compiledTemplates.otp({
      otp,
      purpose
    });
    
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to
    });
    
    console.log(`OTP SMS sent to ${to}: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error(`Error sending OTP SMS to ${to}:`, error.message);
    throw new Error('Failed to send OTP via SMS');
  }
};

module.exports = {
  sendEmergencyAlert,
  sendStatusUpdate,
  sendOTP
};

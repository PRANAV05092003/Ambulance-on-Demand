const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Read email templates
const templates = {
  verification: fs.readFileSync(path.join(__dirname, '../templates/verification-email.ejs'), 'utf8'),
  passwordReset: fs.readFileSync(path.join(__dirname, '../templates/password-reset.ejs'), 'utf8'),
  emergencyAlert: fs.readFileSync(path.join(__dirname, '../templates/emergency-alert.ejs'), 'utf8')
};

// Compile templates
const compiledTemplates = {
  verification: ejs.compile(templates.verification),
  passwordReset: ejs.compile(templates.passwordReset),
  emergencyAlert: ejs.compile(templates.emergencyAlert)
};

/**
 * Send verification email
 * @param {string} to - Recipient email
 * @param {string} token - Verification token
 * @returns {Promise}
 */
const sendVerificationEmail = async (to, token) => {
  try {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    const mailOptions = {
      from: `"Ambulance on Demand" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: 'Verify Your Email Address',
      html: compiledTemplates.verification({
        verificationUrl,
        appName: 'Ambulance on Demand',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@ambulanceondemand.com'
      })
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} token - Password reset token
 * @returns {Promise}
 */
const sendPasswordResetEmail = async (to, token) => {
  try {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: `"Ambulance on Demand" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject: 'Password Reset Request',
      html: compiledTemplates.passwordReset({
        resetUrl,
        appName: 'Ambulance on Demand',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@ambulanceondemand.com',
        expiresIn: '1 hour'
      })
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send emergency alert to contacts
 * @param {Object} options - Alert options
 * @param {string} options.patientName - Name of the patient
 * @param {Array} options.contacts - Array of contact objects {name, phone, email}
 * @param {Object} options.location - Emergency location {address, coordinates}
 * @param {string} options.emergencyId - Emergency ID for tracking
 * @returns {Promise}
 */
const sendEmergencyAlert = async ({ patientName, contacts, location, emergencyId }) => {
  try {
    const trackingUrl = `${process.env.FRONTEND_URL}/track-emergency/${emergencyId}`;
    
    const sendPromises = contacts.map(async (contact) => {
      if (!contact.email) return null;
      
      const mailOptions = {
        from: `"Ambulance on Demand Alert" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: contact.email,
        subject: `Emergency Alert: ${patientName} has requested an ambulance`,
        html: compiledTemplates.emergencyAlert({
          patientName,
          contactName: contact.name || 'there',
          location: location.address,
          trackingUrl,
          appName: 'Ambulance on Demand',
          supportEmail: process.env.SUPPORT_EMAIL || 'support@ambulanceondemand.com'
        })
      };
      
      return transporter.sendMail(mailOptions);
    });
    
    const results = await Promise.allSettled(sendPromises);
    console.log(`Emergency alerts sent to ${results.length} contacts`);
    return results;
  } catch (error) {
    console.error('Error sending emergency alerts:', error);
    throw new Error('Failed to send emergency alerts');
  }
};

/**
 * Send status update email
 * @param {Object} options - Status update options
 * @param {string} options.to - Recipient email
 * @param {string} options.patientName - Name of the patient
 * @param {string} options.status - Current status
 * @param {string} options.ambulanceNumber - Ambulance number
 * @param {string} options.driverName - Driver name
 * @param {string} options.eta - Estimated time of arrival
 * @returns {Promise}
 */
const sendStatusUpdate = async ({ to, patientName, status, ambulanceNumber, driverName, eta }) => {
  try {
    let subject = '';
    let templateData = {
      patientName,
      status,
      ambulanceNumber,
      driverName,
      eta,
      appName: 'Ambulance on Demand',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@ambulanceondemand.com'
    };
    
    switch (status.toLowerCase()) {
      case 'dispatched':
        subject = `Ambulance Dispatched for ${patientName}`;
        break;
      case 'in transit':
        subject = `Ambulance is on the way to ${patientName}`;
        break;
      case 'arrived':
        subject = `Ambulance has arrived for ${patientName}`;
        break;
      case 'completed':
        subject = `Emergency Service Completed for ${patientName}`;
        break;
      default:
        subject = `Update on Emergency for ${patientName}`;
    }
    
    const mailOptions = {
      from: `"Ambulance on Demand" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to,
      subject,
      html: compiledTemplates.statusUpdate(templateData)
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`Status update email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending status update email:', error);
    throw new Error('Failed to send status update email');
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmergencyAlert,
  sendStatusUpdate
};

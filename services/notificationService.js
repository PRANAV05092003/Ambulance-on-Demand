const Emergency = require('../models/Emergency');
const User = require('../models/User');
const { sendStatusUpdate } = require('./emailService');
const { sendStatusUpdate: sendSmsStatusUpdate } = require('./smsService');

class NotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Send real-time notification to specific user
   * @param {string} userId - User ID to send notification to
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  async notifyUser(userId, event, data) {
    try {
      this.io.to(`user_${userId}`).emit(event, data);
      console.log(`Notification sent to user ${userId}: ${event}`);
    } catch (error) {
      console.error(`Error notifying user ${userId}:`, error);
    }
  }

  /**
   * Send real-time notification to all users in a hospital
   * @param {string} hospitalId - Hospital ID
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  async notifyHospital(hospitalId, event, data) {
    try {
      this.io.to(`hospital_${hospitalId}`).emit(event, data);
      console.log(`Notification sent to hospital ${hospitalId}: ${event}`);
    } catch (error) {
      console.error(`Error notifying hospital ${hospitalId}:`, error);
    }
  }

  /**
   * Send real-time notification to all users in an emergency room
   * @param {string} emergencyId - Emergency ID
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  async notifyEmergency(emergencyId, event, data) {
    try {
      this.io.to(`emergency_${emergencyId}`).emit(event, data);
      console.log(`Notification sent to emergency ${emergencyId}: ${event}`);
    } catch (error) {
      console.error(`Error notifying emergency ${emergencyId}:`, error);
    }
  }

  /**
   * Handle emergency status updates and send appropriate notifications
   * @param {string} emergencyId - Emergency ID
   * @param {string} status - New status
   * @param {string} updatedBy - User ID who updated the status
   */
  async handleEmergencyStatusUpdate(emergencyId, status, updatedBy) {
    try {
      const emergency = await Emergency.findById(emergencyId)
        .populate('patient', 'name email phone')
        .populate('assignedAmbulance', 'vehicleNumber driver')
        .populate('assignedAmbulance.driver', 'name phone')
        .populate('hospital', 'name');

      if (!emergency) {
        console.error(`Emergency ${emergencyId} not found`);
        return;
      }

      // Notify all users in the emergency room
      await this.notifyEmergency(emergencyId, 'status_updated', {
        emergencyId,
        status,
        updatedAt: new Date(),
        updatedBy
      });

      // Notify hospital staff
      await this.notifyHospital(emergency.hospital._id, 'emergency_updated', {
        emergencyId,
        status,
        patientName: emergency.patient.name,
        updatedAt: new Date()
      });

      // Send email/SMS to patient and emergency contacts if status is important
      if (['dispatched', 'in_transit', 'arrived', 'completed'].includes(status.toLowerCase())) {
        await this.sendStatusUpdateNotifications(emergency, status);
      }
    } catch (error) {
      console.error('Error in handleEmergencyStatusUpdate:', error);
    }
  }

  /**
   * Send status update notifications via email and SMS
   * @param {Object} emergency - Emergency document
   * @param {string} status - New status
   */
  async sendStatusUpdateNotifications(emergency, status) {
    try {
      const { patient, assignedAmbulance } = emergency;
      
      // Prepare status update data
      const statusData = {
        patientName: patient.name,
        status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
        ambulanceNumber: assignedAmbulance?.vehicleNumber || 'N/A',
        driverName: assignedAmbulance?.driver?.name || 'N/A',
        eta: emergency.estimatedArrivalTime ? 
          new Date(emergency.estimatedArrivalTime).toLocaleTimeString() : 'Shortly'
      };

      // Send email to patient
      if (patient.email) {
        await sendStatusUpdate({
          to: patient.email,
          ...statusData
        });
      }

      // Send SMS to patient
      if (patient.phone) {
        await sendSmsStatusUpdate({
          to: patient.phone,
          ...statusData
        });
      }

      // Get emergency contacts
      const user = await User.findById(patient._id).select('emergencyContacts');
      
      if (user?.emergencyContacts?.length > 0) {
        // Send notifications to emergency contacts
        const notificationPromises = user.emergencyContacts.map(async (contact) => {
          if (contact.phone) {
            await sendSmsStatusUpdate({
              to: contact.phone,
              ...statusData,
              contactName: contact.name
            });
          }
        });

        await Promise.all(notificationPromises);
      }
    } catch (error) {
      console.error('Error sending status update notifications:', error);
    }
  }

  /**
   * Handle new emergency assignment
   * @param {Object} emergency - Emergency document
   */
  async handleNewEmergency(emergency) {
    try {
      if (!emergency.assignedAmbulance) return;

      const populatedEmergency = await Emergency.findById(emergency._id)
        .populate('patient', 'name')
        .populate('assignedAmbulance', 'vehicleNumber driver')
        .populate('assignedAmbulance.driver', 'name phone')
        .populate('hospital', 'name');

      // Notify the assigned driver
      if (populatedEmergency.assignedAmbulance?.driver) {
        const driverId = populatedEmergency.assignedAmbulance.driver._id;
        await this.notifyUser(driverId, 'new_assignment', {
          emergency: populatedEmergency.toObject(),
          assignedAt: new Date()
        });
      }

      // Notify hospital staff
      await this.notifyHospital(
        populatedEmergency.hospital._id,
        'new_emergency',
        populatedEmergency.toObject()
      );

      // Notify patient
      await this.notifyUser(
        populatedEmergency.patient._id,
        'emergency_assigned',
        {
          emergencyId: populatedEmergency._id,
          ambulanceNumber: populatedEmergency.assignedAmbulance?.vehicleNumber,
          driverName: populatedEmergency.assignedAmbulance?.driver?.name,
          estimatedArrival: populatedEmergency.estimatedArrivalTime
        }
      );
    } catch (error) {
      console.error('Error in handleNewEmergency:', error);
    }
  }
}

module.exports = NotificationService;

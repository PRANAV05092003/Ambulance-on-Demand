const Emergency = require('../models/Emergency');
const Ambulance = require('../models/Ambulance');
const Hospital = require('../models/Hospital');
const { Client } = require('@googlemaps/google-maps-services-js');
const client = new Client({});

// @desc    Create a new emergency request
// @route   POST /api/emergency
// @access  Private
exports.createEmergency = async (req, res) => {
  try {
    const { location, medicalInfo, priority = 'Medium' } = req.body;
    const patientId = req.user.id;

    // Find nearest hospital with available capacity
    const hospital = await findNearestHospital(location.coordinates);
    
    if (!hospital) {
      return res.status(503).json({ message: 'No hospitals available at the moment' });
    }

    // Create emergency record
    const emergency = await Emergency.create({
      patient: patientId,
      location: {
        type: 'Point',
        coordinates: location.coordinates,
        address: location.address,
        additionalInfo: location.additionalInfo
      },
      hospital: hospital._id,
      priority,
      medicalInfo,
      status: 'Pending',
      timeline: [{
        status: 'Pending',
        notes: 'Emergency request created',
        location: {
          type: 'Point',
          coordinates: location.coordinates
        }
      }]
    });

    // Find and assign nearest available ambulance
    await assignAmbulance(emergency);

    // Notify hospital and update emergency status
    const updatedEmergency = await Emergency.findById(emergency._id)
      .populate('patient', 'name phone medicalInfo')
      .populate('assignedAmbulance', 'vehicleNumber driver');

    // Emit real-time update
    req.app.get('io').to(`hospital_${hospital._id}`).emit('new_emergency', updatedEmergency);

    res.status(201).json(updatedEmergency);
  } catch (error) {
    console.error('Create emergency error:', error);
    res.status(500).json({ message: 'Server error creating emergency' });
  }
};

// @desc    Get emergency by ID
// @route   GET /api/emergency/:id
// @access  Private
exports.getEmergencyById = async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id)
      .populate('patient', 'name phone')
      .populate('hospital', 'name address')
      .populate('assignedAmbulance', 'vehicleNumber driver currentLocation');

    if (!emergency) {
      return res.status(404).json({ message: 'Emergency not found' });
    }

    // Check if user is authorized to view this emergency
    if (
      emergency.patient._id.toString() !== req.user.id && 
      req.user.role !== 'hospital_admin' &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'Not authorized to view this emergency' });
    }

    res.json(emergency);
  } catch (error) {
    console.error('Get emergency error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update emergency status
// @route   PUT /api/emergency/:id/status
// @access  Private
exports.updateEmergencyStatus = async (req, res) => {
  try {
    const { status, notes = '' } = req.body;
    
    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      return res.status(404).json({ message: 'Emergency not found' });
    }

    // Check if user is authorized to update this emergency
    if (
      emergency.patient.toString() !== req.user.id && 
      req.user.role !== 'hospital_admin' &&
      req.user.role !== 'admin' &&
      req.user.role !== 'driver'
    ) {
      return res.status(403).json({ message: 'Not authorized to update this emergency' });
    }

    // Update emergency status
    await emergency.updateStatus(status, notes);

    // If ambulance is dispatched, update its status
    if (status === 'Dispatched' && emergency.assignedAmbulance) {
      await Ambulance.findByIdAndUpdate(emergency.assignedAmbulance, {
        status: 'On Duty',
        currentEmergency: emergency._id
      });
    }

    // If emergency is completed, update ambulance status
    if (status === 'Completed' && emergency.assignedAmbulance) {
      await Ambulance.findByIdAndUpdate(emergency.assignedAmbulance, {
        status: 'Available',
        currentEmergency: null
      });
    }

    const updatedEmergency = await Emergency.findById(emergency._id)
      .populate('patient', 'name phone')
      .populate('hospital', 'name address')
      .populate('assignedAmbulance', 'vehicleNumber driver currentLocation');

    // Emit real-time update
    req.app.get('io').to(`emergency_${emergency._id}`).emit('status_update', updatedEmergency);
    
    if (emergency.hospital) {
      req.app.get('io').to(`hospital_${emergency.hospital}`).emit('emergency_updated', updatedEmergency);
    }

    res.json(updatedEmergency);
  } catch (error) {
    console.error('Update emergency status error:', error);
    res.status(500).json({ message: 'Server error updating emergency status' });
  }
};

// @desc    Get emergencies for hospital
// @route   GET /api/emergency/hospital/:hospitalId
// @access  Private
exports.getHospitalEmergencies = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { hospital: req.params.hospitalId };
    
    if (status) {
      query.status = status;
    }

    const emergencies = await Emergency.find(query)
      .populate('patient', 'name phone')
      .populate('assignedAmbulance', 'vehicleNumber driver')
      .sort({ createdAt: -1 });

    res.json(emergencies);
  } catch (error) {
    console.error('Get hospital emergencies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user emergencies
// @route   GET /api/emergency/user/:userId
// @access  Private
exports.getUserEmergencies = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    // Check if user is authorized
    if (userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const emergencies = await Emergency.find({ patient: userId })
      .populate('hospital', 'name address')
      .populate('assignedAmbulance', 'vehicleNumber driver')
      .sort({ createdAt: -1 });

    res.json(emergencies);
  } catch (error) {
    console.error('Get user emergencies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper function to find nearest hospital with available capacity
async function findNearestHospital(coordinates) {
  try {
    // Find hospitals within 20km radius with available capacity
    const hospitals = await Hospital.find({
      'address.location': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          $maxDistance: 20000 // 20km in meters
        }
      },
      isActive: true
    });

    if (hospitals.length === 0) {
      return null;
    }

    // For simplicity, return the nearest hospital
    // In a real app, you might want to check capacity and other factors
    return hospitals[0];
  } catch (error) {
    console.error('Find nearest hospital error:', error);
    return null;
  }
}

// Helper function to assign nearest available ambulance
async function assignAmbulance(emergency) {
  try {
    // Find available ambulances for the hospital
    const ambulance = await Ambulance.findOneAndUpdate(
      {
        hospital: emergency.hospital,
        status: 'Available',
        isActive: true
      },
      { status: 'On Duty', currentEmergency: emergency._id },
      { new: true, sort: { 'currentLocation.coordinates': '2dsphere' } }
    );

    if (ambulance) {
      // Update emergency with assigned ambulance
      emergency.assignedAmbulance = ambulance._id;
      emergency.status = 'Dispatched';
      
      // Calculate ETA using Google Maps API
      try {
        const response = await client.directions({
          params: {
            origin: ambulance.currentLocation.coordinates.reverse().join(','),
            destination: emergency.location.coordinates.join(','),
            key: process.env.GOOGLE_MAPS_API_KEY,
            mode: 'driving',
            traffic_model: 'best_guess',
            departure_time: 'now'
          },
          timeout: 1000
        });

        if (response.data.routes.length > 0) {
          const duration = response.data.routes[0].legs[0].duration_in_traffic || 
                          response.data.routes[0].legs[0].duration;
          emergency.estimatedArrivalTime = new Date(Date.now() + duration.value * 1000);
        }
      } catch (mapsError) {
        console.error('Error calculating ETA:', mapsError);
      }

      await emergency.save();
      return ambulance;
    }
    
    return null;
  } catch (error) {
    console.error('Assign ambulance error:', error);
    return null;
  }
}

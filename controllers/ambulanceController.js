const Ambulance = require('../models/Ambulance');
const Emergency = require('../models/Emergency');
const { validationResult } = require('express-validator');

// @desc    Get all ambulances
// @route   GET /api/ambulance
// @access  Private/Admin
const getAllAmbulances = async (req, res) => {
  try {
    const { status, hospital } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (hospital) {
      query.hospital = hospital;
    }
    
    const ambulances = await Ambulance.find(query)
      .populate('driver', 'name phone')
      .populate('hospital', 'name')
      .populate('currentEmergency', 'status');
      
    res.json(ambulances);
  } catch (error) {
    console.error('Get all ambulances error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get ambulance by ID
// @route   GET /api/ambulance/:id
// @access  Private
const getAmbulanceById = async (req, res) => {
  try {
    const ambulance = await Ambulance.findById(req.params.id)
      .populate('driver', 'name phone')
      .populate('hospital', 'name address')
      .populate('currentEmergency', 'status location');
      
    if (!ambulance) {
      return res.status(404).json({ message: 'Ambulance not found' });
    }
    
    // Check if user is authorized
    if (
      req.user.role !== 'admin' && 
      req.user.role !== 'hospital_admin' &&
      ambulance.driver._id.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized to view this ambulance' });
    }
    
    res.json(ambulance);
  } catch (error) {
    console.error('Get ambulance by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new ambulance
// @route   POST /api/ambulance
// @access  Private/Admin
const createAmbulance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { 
      vehicleNumber, 
      model, 
      type, 
      capacity, 
      equipment, 
      driver, 
      hospital 
    } = req.body;
    
    // Check if vehicle number already exists
    const ambulanceExists = await Ambulance.findOne({ vehicleNumber });
    if (ambulanceExists) {
      return res.status(400).json({ message: 'Ambulance with this vehicle number already exists' });
    }
    
    const ambulance = new Ambulance({
      vehicleNumber,
      model,
      type,
      capacity,
      equipment: equipment || [],
      driver,
      hospital,
      status: 'Available',
      isActive: true
    });
    
    const createdAmbulance = await ambulance.save();
    
    res.status(201).json(createdAmbulance);
  } catch (error) {
    console.error('Create ambulance error:', error);
    res.status(500).json({ message: 'Server error creating ambulance' });
  }
};

// @desc    Update ambulance
// @route   PUT /api/ambulance/:id
// @access  Private
const updateAmbulance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { 
      model, 
      type, 
      capacity, 
      equipment, 
      driver, 
      hospital,
      status,
      isActive
    } = req.body;
    
    const ambulance = await Ambulance.findById(req.params.id);
    
    if (!ambulance) {
      return res.status(404).json({ message: 'Ambulance not found' });
    }
    
    // Check if user is authorized
    if (
      req.user.role !== 'admin' && 
      req.user.role !== 'hospital_admin' &&
      ambulance.driver.toString() !== req.user.id
    ) {
      return res.status(403).json({ message: 'Not authorized to update this ambulance' });
    }
    
    // Update fields
    if (model) ambulance.model = model;
    if (type) ambulance.type = type;
    if (capacity) ambulance.capacity = capacity;
    if (equipment) ambulance.equipment = equipment;
    if (driver) ambulance.driver = driver;
    if (hospital) ambulance.hospital = hospital;
    if (status) ambulance.status = status;
    if (isActive !== undefined) ambulance.isActive = isActive;
    
    const updatedAmbulance = await ambulance.save();
    
    res.json(updatedAmbulance);
  } catch (error) {
    console.error('Update ambulance error:', error);
    res.status(500).json({ message: 'Server error updating ambulance' });
  }
};

// @desc    Update ambulance location
// @route   PUT /api/ambulance/:id/location
// @access  Private/Driver
const updateAmbulanceLocation = async (req, res) => {
  try {
    const { coordinates, address } = req.body;
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      return res.status(400).json({ message: 'Valid coordinates are required' });
    }
    
    const ambulance = await Ambulance.findById(req.params.id);
    
    if (!ambulance) {
      return res.status(404).json({ message: 'Ambulance not found' });
    }
    
    // Check if user is the driver of this ambulance
    if (ambulance.driver.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this ambulance location' });
    }
    
    // Update location
    ambulance.currentLocation = {
      type: 'Point',
      coordinates,
      address,
      lastUpdated: new Date()
    };
    
    await ambulance.save();
    
    // If ambulance is on a call, update the emergency with current location
    if (ambulance.currentEmergency) {
      const emergency = await Emergency.findById(ambulance.currentEmergency);
      if (emergency) {
        emergency.timeline.push({
          status: emergency.status,
          notes: 'Ambulance location updated',
          location: {
            type: 'Point',
            coordinates
          }
        });
        await emergency.save();
        
        // Emit real-time update
        req.app.get('io').to(`emergency_${emergency._id}`).emit('ambulance_location_update', {
          emergencyId: emergency._id,
          location: coordinates,
          address,
          timestamp: new Date()
        });
      }
    }
    
    res.json({ 
      message: 'Location updated successfully',
      location: ambulance.currentLocation 
    });
  } catch (error) {
    console.error('Update ambulance location error:', error);
    res.status(500).json({ message: 'Server error updating location' });
  }
};

// @desc    Get active emergency for ambulance
// @route   GET /api/ambulance/:id/emergency
// @access  Private/Driver
const getAmbulanceEmergency = async (req, res) => {
  try {
    const ambulance = await Ambulance.findById(req.params.id)
      .populate('currentEmergency');
      
    if (!ambulance) {
      return res.status(404).json({ message: 'Ambulance not found' });
    }
    
    // Check if user is the driver of this ambulance
    if (ambulance.driver.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this ambulance\'s emergency' });
    }
    
    if (!ambulance.currentEmergency) {
      return res.json({ message: 'No active emergency for this ambulance' });
    }
    
    const emergency = await Emergency.findById(ambulance.currentEmergency)
      .populate('patient', 'name phone medicalInfo')
      .populate('hospital', 'name address');
      
    res.json(emergency);
  } catch (error) {
    console.error('Get ambulance emergency error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get ambulances by hospital
// @route   GET /api/ambulance/hospital/:hospitalId
// @access  Private/Hospital Admin
const getAmbulancesByHospital = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { hospital: req.params.hospitalId };
    
    if (status) {
      query.status = status;
    }
    
    // Check if user is hospital admin for this hospital
    if (req.user.role === 'hospital_admin' && req.user.hospital.toString() !== req.params.hospitalId) {
      return res.status(403).json({ message: 'Not authorized to view these ambulances' });
    }
    
    const ambulances = await Ambulance.find(query)
      .populate('driver', 'name phone')
      .populate('currentEmergency', 'status');
      
    res.json(ambulances);
  } catch (error) {
    console.error('Get ambulances by hospital error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllAmbulances,
  getAmbulanceById,
  createAmbulance,
  updateAmbulance,
  updateAmbulanceLocation,
  getAmbulanceEmergency,
  getAmbulancesByHospital
};

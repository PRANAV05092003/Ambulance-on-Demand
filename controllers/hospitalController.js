const Hospital = require('../models/Hospital');
const Ambulance = require('../models/Ambulance');
const Emergency = require('../models/Emergency');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all hospitals
// @route   GET /api/hospital
// @access  Public
exports.getAllHospitals = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    
    const query = { isActive: true };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } }
      ];
    }
    
    const hospitals = await Hospital.find(query)
      .select('-staff -facilities -workingHours') // Exclude large fields
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 });
    
    const count = await Hospital.countDocuments(query);
    
    res.json({
      hospitals,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Get all hospitals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get nearest hospitals
// @route   GET /api/hospital/nearest
// @access  Public
exports.getNearestHospitals = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 10000 } = req.query; // Default 10km
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }
    
    const hospitals = await Hospital.find({
      'address.location': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      isActive: true
    })
    .limit(10) // Limit to 10 nearest hospitals
    .select('name address contact facilities');
    
    res.json(hospitals);
  } catch (error) {
    console.error('Get nearest hospitals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get hospital by ID
// @route   GET /api/hospital/:id
// @access  Public
exports.getHospitalById = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id)
      .populate('admin', 'name email phone')
      .populate('staff.user', 'name email phone role');
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    res.json(hospital);
  } catch (error) {
    console.error('Get hospital by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create new hospital
// @route   POST /api/hospital
// @access  Private/Admin
exports.createHospital = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      name,
      registrationNumber,
      contact,
      address,
      facilities = [],
      workingHours,
      admin
    } = req.body;
    
    // Check if hospital with same registration number exists
    const hospitalExists = await Hospital.findOne({ registrationNumber });
    if (hospitalExists) {
      return res.status(400).json({ message: 'Hospital with this registration number already exists' });
    }
    
    // Check if admin user exists and is hospital admin
    const adminUser = await User.findById(admin);
    if (!adminUser) {
      return res.status(400).json({ message: 'Admin user not found' });
    }
    
    if (adminUser.role !== 'hospital_admin') {
      return res.status(400).json({ message: 'Admin user must have hospital_admin role' });
    }
    
    // Create hospital
    const hospital = new Hospital({
      name,
      registrationNumber,
      contact,
      address: {
        ...address,
        location: {
          type: 'Point',
          coordinates: address.location.coordinates
        }
      },
      facilities,
      workingHours: workingHours || {
        monday: { open: '00:00', close: '23:59' },
        tuesday: { open: '00:00', close: '23:59' },
        wednesday: { open: '00:00', close: '23:59' },
        thursday: { open: '00:00', close: '23:59' },
        friday: { open: '00:00', close: '23:59' },
        saturday: { open: '00:00', close: '23:59' },
        sunday: { open: '00:00', close: '23:59' },
        emergency: true
      },
      admin,
      staff: [{
        user: admin,
        role: 'admin',
        department: 'Administration',
        isActive: true
      }],
      isActive: true
    });
    
    const createdHospital = await hospital.save();
    
    // Update admin user with hospital reference
    adminUser.hospital = createdHospital._id;
    await adminUser.save();
    
    res.status(201).json(createdHospital);
  } catch (error) {
    console.error('Create hospital error:', error);
    res.status(500).json({ message: 'Server error creating hospital' });
  }
};

// @desc    Update hospital
// @route   PUT /api/hospital/:id
// @access  Private/Admin
exports.updateHospital = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    // Check if user is authorized (admin or hospital admin of this hospital)
    if (req.user.role === 'hospital_admin' && hospital.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this hospital' });
    }
    
    const {
      name,
      contact,
      address,
      facilities,
      workingHours,
      isActive
    } = req.body;
    
    // Update fields
    if (name) hospital.name = name;
    if (contact) hospital.contact = { ...hospital.contact, ...contact };
    if (address) {
      hospital.address = {
        ...hospital.address,
        ...address,
        location: address.location ? {
          type: 'Point',
          coordinates: address.location.coordinates || hospital.address.location.coordinates
        } : hospital.address.location
      };
    }
    if (facilities) hospital.facilities = facilities;
    if (workingHours) hospital.workingHours = { ...hospital.workingHours, ...workingHours };
    if (isActive !== undefined) hospital.isActive = isActive;
    
    const updatedHospital = await hospital.save();
    
    res.json(updatedHospital);
  } catch (error) {
    console.error('Update hospital error:', error);
    res.status(500).json({ message: 'Server error updating hospital' });
  }
};

// @desc    Delete hospital
// @route   DELETE /api/hospital/:id
// @access  Private/Admin
exports.deleteHospital = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    // Soft delete by setting isActive to false
    hospital.isActive = false;
    await hospital.save();
    
    // Optionally, deactivate all related ambulances
    await Ambulance.updateMany(
      { hospital: hospital._id },
      { $set: { isActive: false, status: 'Unavailable' } }
    );
    
    res.json({ message: 'Hospital deactivated successfully' });
  } catch (error) {
    console.error('Delete hospital error:', error);
    res.status(500).json({ message: 'Server error deactivating hospital' });
  }
};

// @desc    Get ambulances for hospital
// @route   GET /api/hospital/:id/ambulances
// @access  Private/Hospital Admin
exports.getHospitalAmbulances = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    // Check if user is authorized (admin or hospital admin of this hospital)
    if (req.user.role === 'hospital_admin' && hospital.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view these ambulances' });
    }
    
    const ambulances = await Ambulance.find({ hospital: hospital._id })
      .populate('driver', 'name phone')
      .populate('currentEmergency', 'status');
    
    res.json(ambulances);
  } catch (error) {
    console.error('Get hospital ambulances error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get emergencies for hospital
// @route   GET /api/hospital/:id/emergencies
// @access  Private/Hospital Admin
exports.getHospitalEmergencies = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    // Check if user is authorized (admin or hospital admin of this hospital)
    if (req.user.role === 'hospital_admin' && hospital.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view these emergencies' });
    }
    
    const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    const query = { hospital: hospital._id };
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const emergencies = await Emergency.find(query)
      .populate('patient', 'name phone')
      .populate('assignedAmbulance', 'vehicleNumber driver')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const count = await Emergency.countDocuments(query);
    
    res.json({
      emergencies,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Get hospital emergencies error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add staff to hospital
// @route   POST /api/hospital/:id/staff
// @access  Private/Hospital Admin
exports.addStaff = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    // Check if user is authorized (admin or hospital admin of this hospital)
    if (req.user.role === 'hospital_admin' && hospital.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to add staff' });
    }
    
    const { userId, role, department } = req.body;
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is already a staff member
    const staffExists = hospital.staff.some(staff => 
      staff.user.toString() === userId && 
      staff.role === role && 
      staff.department === department
    );
    
    if (staffExists) {
      return res.status(400).json({ message: 'User is already a staff member with this role and department' });
    }
    
    // Add staff
    hospital.staff.push({
      user: userId,
      role,
      department,
      isActive: true
    });
    
    // Update user role if needed
    if (user.role !== 'hospital_admin' && user.role !== 'admin') {
      user.role = role === 'admin' ? 'hospital_admin' : 'staff';
      user.hospital = hospital._id;
      await user.save();
    }
    
    await hospital.save();
    
    res.status(201).json({ message: 'Staff added successfully' });
  } catch (error) {
    console.error('Add staff error:', error);
    res.status(500).json({ message: 'Server error adding staff' });
  }
};

// @desc    Update hospital staff
// @route   PUT /api/hospital/:id/staff/:staffId
// @access  Private/Hospital Admin
exports.updateStaff = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    // Check if user is authorized (admin or hospital admin of this hospital)
    if (req.user.role === 'hospital_admin' && hospital.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update staff' });
    }
    
    const { role, isActive } = req.body;
    const staffId = req.params.staffId;
    
    // Find staff member
    const staffIndex = hospital.staff.findIndex(staff => staff._id.toString() === staffId);
    
    if (staffIndex === -1) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    
    // Update staff member
    if (role) hospital.staff[staffIndex].role = role;
    if (isActive !== undefined) hospital.staff[staffIndex].isActive = isActive;
    
    await hospital.save();
    
    res.json({ message: 'Staff updated successfully' });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ message: 'Server error updating staff' });
  }
};

// @desc    Remove staff from hospital
// @route   DELETE /api/hospital/:id/staff/:staffId
// @access  Private/Hospital Admin
exports.removeStaff = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    // Check if user is authorized (admin or hospital admin of this hospital)
    if (req.user.role === 'hospital_admin' && hospital.admin.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to remove staff' });
    }
    
    const staffId = req.params.staffId;
    
    // Find staff member
    const staffIndex = hospital.staff.findIndex(staff => staff._id.toString() === staffId);
    
    if (staffIndex === -1) {
      return res.status(404).json({ message: 'Staff member not found' });
    }
    
    // Don't remove the hospital admin
    if (hospital.staff[staffIndex].role === 'admin') {
      return res.status(400).json({ message: 'Cannot remove hospital admin' });
    }
    
    // Get user ID before removing
    const userId = hospital.staff[staffIndex].user;
    
    // Remove staff member
    hospital.staff.splice(staffIndex, 1);
    
    await hospital.save();
    
    // Check if user is still a staff member in any department
    const isStillStaff = hospital.staff.some(staff => staff.user.toString() === userId.toString());
    
    if (!isStillStaff) {
      // Update user role if they're no longer a staff member
      const user = await User.findById(userId);
      if (user && user.role !== 'admin') {
        user.role = 'patient';
        user.hospital = undefined;
        await user.save();
      }
    }
    
    res.json({ message: 'Staff removed successfully' });
  } catch (error) {
    console.error('Remove staff error:', error);
    res.status(500).json({ message: 'Server error removing staff' });
  }
};

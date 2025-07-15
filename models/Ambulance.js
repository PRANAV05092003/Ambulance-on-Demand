const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
  vehicleNumber: {
    type: String,
    required: [true, 'Vehicle number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  model: {
    type: String,
    required: [true, 'Vehicle model is required']
  },
  type: {
    type: String,
    enum: ['Basic', 'Advanced', 'Mobile ICU', 'Neonatal'],
    default: 'Basic'
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1']
  },
  equipment: [{
    name: String,
    status: {
      type: String,
      enum: ['Available', 'In Use', 'Under Maintenance', 'Not Available'],
      default: 'Available'
    }
  }],
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Driver is required']
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital is required']
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    address: String,
    lastUpdated: Date
  },
  status: {
    type: String,
    enum: ['Available', 'On Duty', 'In Maintenance', 'Unavailable'],
    default: 'Available'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  currentEmergency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Emergency',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastMaintenance: Date,
  nextMaintenance: Date
});

// Create index for geospatial queries
ambulanceSchema.index({ 'currentLocation.coordinates': '2dsphere' });

// Virtual for getting active ambulances
ambulanceSchema.virtual('isAvailable').get(function() {
  return this.status === 'Available' && this.isActive;
});

module.exports = mongoose.model('Ambulance', ambulanceSchema);

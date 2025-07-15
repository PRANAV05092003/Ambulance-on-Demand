const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient is required']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: [true, 'Coordinates are required']
    },
    address: {
      type: String,
      required: [true, 'Address is required']
    },
    additionalInfo: String
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital is required']
  },
  assignedAmbulance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ambulance'
  },
  status: {
    type: String,
    enum: ['Pending', 'Dispatched', 'In Transit', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  medicalInfo: {
    condition: String,
    symptoms: [String],
    notes: String
  },
  timeline: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      type: {
        type: String,
        default: 'Point'
      },
      coordinates: [Number]
    },
    notes: String
  }],
  estimatedArrivalTime: Date,
  actualArrivalTime: Date,
  completedAt: Date,
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String,
    submittedAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create index for geospatial queries
emergencySchema.index({ 'location.coordinates': '2dsphere' });

// Update the updatedAt field before saving
documentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Add a method to update status and log in timeline
emergencySchema.methods.updateStatus = async function(newStatus, notes = '') {
  this.status = newStatus;
  this.timeline.push({
    status: newStatus,
    notes,
    location: this.assignedAmbulance?.currentLocation || this.location
  });
  
  // Update timestamps based on status
  const now = new Date();
  if (newStatus === 'In Transit') {
    this.actualArrivalTime = now;
  } else if (newStatus === 'Completed') {
    this.completedAt = now;
  }
  
  await this.save();
  return this;
};

module.exports = mongoose.model('Emergency', emergencySchema);

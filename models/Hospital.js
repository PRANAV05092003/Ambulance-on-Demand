const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Hospital name is required'],
    trim: true
  },
  registrationNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true
  },
  contact: {
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number']
    },
    emergencyPhone: {
      type: String,
      match: [/^[0-9]{10,15}$/, 'Please provide a valid phone number']
    },
    website: {
      type: String,
      trim: true
    }
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required']
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      default: 'India'
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
      }
    }
  },
  facilities: [{
    type: String,
    enum: [
      'Emergency', 'ICU', 'NICU', 'PICU', 'Surgery', 'Cardiology', 
      'Neurology', 'Orthopedics', 'Pediatrics', 'Maternity', 'Radiology',
      'Laboratory', 'Pharmacy', 'Ambulance', 'Blood Bank', 'Cath Lab'
    ]
  }],
  workingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String },
    emergency: { 
      type: Boolean, 
      default: true,
      required: true 
    }
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Admin user is required']
  },
  staff: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['doctor', 'nurse', 'staff', 'admin'],
      required: true
    },
    department: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
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
hospitalSchema.index({ 'address.location': '2dsphere' });

// Update the updatedAt field before saving
hospitalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for getting active ambulances
hospitalSchema.virtual('activeAmbulances', {
  ref: 'Ambulance',
  localField: '_id',
  foreignField: 'hospital',
  match: { isActive: true }
});

// Virtual for getting active emergencies
hospitalSchema.virtual('activeEmergencies', {
  ref: 'Emergency',
  localField: '_id',
  foreignField: 'hospital',
  match: { status: { $in: ['Pending', 'Dispatched', 'In Transit'] } }
});

module.exports = mongoose.model('Hospital', hospitalSchema);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const defaultUsers = [
  {
    email: 'axonmedacademy2@gmail.com',
    fullName: 'Admin',
    password: 'axon@admin',
    role: 'admin',
    userId: 'Admin'
  },
  {
    email: 'navin.procols@gmail.com',
    fullName: 'Ajay Kumar',
    password: '1111',
    role: 'student',
    phone: '+91 98700 11110',
    userId: 'Ajay'
  }
];

const seedDefaultUsers = async () => {
  try {
    for (const defaultUser of defaultUsers) {
      const existing = await User.findOne({ email: defaultUser.email }).select('+password');
      if (existing) {
        const passwordMatches = await existing.comparePassword(defaultUser.password);
        existing.fullName = defaultUser.fullName;
        existing.role = defaultUser.role;
        existing.isVerified = true;
        existing.isActive = true;
        if (defaultUser.phone) existing.phone = defaultUser.phone;
        if (defaultUser.userId) existing.userId = defaultUser.userId;
        if (!passwordMatches) existing.password = defaultUser.password;
        await existing.save();
        continue;
      }

      console.log(`[Database] Seeding default ${defaultUser.role} user (${defaultUser.email})...`);
      await User.create({
        ...defaultUser,
        isVerified: true,
        isActive: true
      });
    }
    console.log('[Database] Default users are ready.');
  } catch (err) {
    console.error('[Database] Failed to seed default users:', err.message);
  }
};


const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI;
    console.log(`[Database] Attempting connection to MongoDB...`);

    const conn = await mongoose.connect(connStr, {
      autoIndex: true, // Auto-build indexes in development
    });

    console.log(`[Database] MongoDB Connected successfully to host: ${conn.connection.host}`);

    // Drop old index if it exists to allow reconstruction with partial filter
    try {
      const attendancesCollection = mongoose.connection.collection('attendances');
      const indexes = await attendancesCollection.indexes();
      const hasOldIndex = indexes.some(idx => idx.name === 'meeting_1_student_1');
      if (hasOldIndex) {
        console.log('[Database] Found index meeting_1_student_1. Dropping to apply new partial settings...');
        await attendancesCollection.dropIndex('meeting_1_student_1');
        console.log('[Database] Dropped index meeting_1_student_1 successfully.');
      }
    } catch (indexError) {
      console.log('[Database] Safe-check: index meeting_1_student_1 drop skipped or not found:', indexError.message);
    }

    // Seed default login users
    await seedDefaultUsers();
  } catch (error) {
    console.error(`[Database] MongoDB connection failure: ${error.message}`);
    process.exit(1);
  }
};

// Mongoose connection event listeners
mongoose.connection.on('disconnected', () => {
  console.warn('[Database] MongoDB connection lost. Retrying...');
});

mongoose.connection.on('error', (err) => {
  console.error(`[Database] MongoDB runtime error: ${err}`);
});

module.exports = connectDB;
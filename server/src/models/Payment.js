const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  student:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  enrollment:    { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
  program:       { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  razorpayOrderId:  { type: String, unique: true },
  razorpayPaymentId:{ type: String },
  razorpaySignature:{ type: String },
  amount:        { type: Number, required: true }, // amount in paise
  gstAmount:     { type: Number },
  totalAmount:   { type: Number },
  currency:      { type: String, default: 'INR' },
  method:        { type: String }, // upi, card, netbanking, emi
  status:        { type: String, enum: ['created', 'authorized', 'captured', 'failed', 'refunded'], default: 'created' },
  isEmi:         { type: Boolean, default: false },
  emiDetails: {
    bankName:    String,
    months:      Number,
    monthlyAmt:  Number
  },
  notes:         { type: String },
  receiptUrl:    { type: String }, // S3 receipt PDF URL
  paidAt:        { type: Date }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Payment', paymentSchema);

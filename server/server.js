const dotenv = require('dotenv');
// Load environment configurations
dotenv.config();

const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { initSocket } = require('./src/config/socket');

const PORT = process.env.PORT || 5000;

// Initialize Server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Boot database & listen
const startServer = async () => {
  try {
    await connectDB();
    console.log("PORT =", process.env.PORT);
    server.listen(PORT, "0.0.0.0", () => {
      console.log(` Platform Service is running on port ${PORT}`);;
      console.log(` Current Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error(`[Boot Error] Platform failed to start:`, error.message);
    process.exit(1);
  }
};

startServer();

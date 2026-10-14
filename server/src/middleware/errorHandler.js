const errorHandler = (err, req, res, next) => {
  console.error(`[Error Handler] Details:`, err.stack || err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID format for ${err.path}: ${err.value}`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    error: err.name || 'ServerError'
  });
};

module.exports = errorHandler;

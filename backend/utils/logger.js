const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Structured Logging Configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'scaler-support-backend' },
  transports: [
    new winston.transports.Console()
  ],
});

// Middleware for Trace ID and Request Logging
const requestLogger = (req, res, next) => {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('API_REQUEST', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      traceId: req.traceId,
      userAgent: req.get('user-agent')
    });
  });

  next();
};

module.exports = { logger, requestLogger };

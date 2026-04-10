let sdk = null;

// Only initialize OpenTelemetry if explicitly enabled
if (process.env.SIGNOZ_ENABLED === 'true') {
  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = require('@opentelemetry/resources');
    const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

    // The trace exporter must know where to send trace data
    const traceExporter = new OTLPTraceExporter({
      url: process.env.SIGNOZ_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });

    sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'scaler-support-backend',
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'production',
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // We can disable specific instrumentations if they're too noisy
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    console.log('SigNoz APM Instrumentation Active');
    sdk.start();

    // Ensure clean shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => console.log('Tracing terminated'))
        .catch((error) => console.log('Error terminating tracing', error))
        .finally(() => process.exit(0));
    });
  } catch (error) {
    console.log('Failed to initialize OpenTelemetry:', error.message);
    sdk = null;
  }
}

module.exports = sdk;

import pino from "pino";

const logger = pino({
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  base: {
    app: "pharminc-backend",
  },
});

export function getServiceLogger(service: string) {
  return logger.child({ service });
}

export default logger;

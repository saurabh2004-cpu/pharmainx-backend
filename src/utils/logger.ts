const getServiceLogger = (serviceName: string) => {
    return {
        info: (obj: object | string, msg?: string) => {
            if (typeof obj === 'string') {
                console.log(`[${serviceName}] [INFO]: ${obj}`);
            } else {
                console.log(`[${serviceName}] [INFO]: ${msg}`, JSON.stringify(obj));
            }
        },
        warn: (obj: object | string, msg?: string) => {
            if (typeof obj === 'string') {
                console.warn(`[${serviceName}] [WARN]: ${obj}`);
            } else {
                console.warn(`[${serviceName}] [WARN]: ${msg}`, JSON.stringify(obj));
            }
        },
        error: (obj: object | string, msg?: string) => {
            if (typeof obj === 'string') {
                console.error(`[${serviceName}] [ERROR]: ${obj}`);
            } else {
                console.error(`[${serviceName}] [ERROR]: ${msg}`, JSON.stringify(obj));
            }
        },
        debug: (obj: object | string, msg?: string) => {
            if (typeof obj === 'string') {
                console.debug(`[${serviceName}] [DEBUG]: ${obj}`);
            } else {
                console.debug(`[${serviceName}] [DEBUG]: ${msg}`, JSON.stringify(obj));
            }
        },
    };
};

export { getServiceLogger };

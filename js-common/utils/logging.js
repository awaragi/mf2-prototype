/**
 * Logging utilities that wrap console methods with LEVEL prefixes
 */

/**
 * Wrapper for console.log that adds [LOG] level prefix
 * @param {...any} args - Arguments to pass to console.log
 */
function log(...args) {
    console.log('[LOG]', ...args);
}

/**
 * Wrapper for console.info that adds [INFO] level prefix
 * @param {...any} args - Arguments to pass to console.info
 */
function info(...args) {
    console.info('[INFO]', ...args);
}

/**
 * Wrapper for console.warn that adds [WARN] level prefix
 * @param {...any} args - Arguments to pass to console.warn
 */
function warn(...args) {
    console.warn('[WARN]', ...args);
}

/**
 * Wrapper for console.error that adds [ERROR] level prefix
 * @param {...any} args - Arguments to pass to console.error
 */
function error(...args) {
    console.error('[ERROR]', ...args);
}

/**
 * Wrapper for console.debug that adds [DEBUG] level prefix
 * @param {...any} args - Arguments to pass to console.debug
 */
function debug(...args) {
    console.debug('[DEBUG]', ...args);
}

export const logger = {
    log,
    info,
    warn,
    error,
    debug,
}
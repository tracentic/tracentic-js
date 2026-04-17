const PREFIX = "[tracentic]";

let _debug = false;

export function setDebug(enabled: boolean): void {
  _debug = enabled;
}

export function isDebug(): boolean {
  return _debug;
}

/** Always emitted - indicates a problem that may cause data loss. */
export function warn(message: string): void {
  console.warn(`${PREFIX} ${message}`);
}

/** Only emitted when debug mode is enabled. */
export function debug(message: string): void {
  if (_debug) {
    console.debug(`${PREFIX} ${message}`);
  }
}

/** Always emitted - informational messages about SDK state. */
export function info(message: string): void {
  console.info(`${PREFIX} ${message}`);
}

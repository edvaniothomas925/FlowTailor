export interface SecurityLogEvent {
  id: string;
  timestamp: string;
  type:
    | 'AUTH_SUCCESS'
    | 'AUTH_FAILURE'
    | 'RATE_LIMIT_TRIGGERED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'INVALID_INPUT'
    | 'XSS_ATTEMPT_BLOCKED'
    | 'SUSPICIOUS_PAYLOAD'
    | 'CSRF_BLOCKED'
    | 'SESSION_EXPIRED'
    | 'DATA_VALIDATED'
    | 'DATA_CREATED';
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  ip: string;
  path: string;
  method: string;
  details: string;
}

// In-memory ring buffer of recent security events (tamper-resistant)
const MAX_LOGS = 200;
const auditLogs: SecurityLogEvent[] = [];

let totalThreatsBlocked = 0;
let totalRequestsAnalyzed = 0;

export function logSecurityEvent(event: Omit<SecurityLogEvent, 'id' | 'timestamp'>): SecurityLogEvent {
  totalRequestsAnalyzed += 1;
  if (event.severity === 'WARN' || event.severity === 'CRITICAL') {
    totalThreatsBlocked += 1;
  }

  const logEntry: SecurityLogEvent = {
    id: `sec-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };

  auditLogs.unshift(logEntry);
  if (auditLogs.length > MAX_LOGS) {
    auditLogs.pop();
  }

  // Console output formatted with security tags
  const prefix = `[SECURITY][${logEntry.severity}][${logEntry.type}]`;
  if (logEntry.severity === 'CRITICAL') {
    console.error(`${prefix} ${logEntry.ip} -> ${logEntry.method} ${logEntry.path}: ${logEntry.details}`);
  } else if (logEntry.severity === 'WARN') {
    console.warn(`${prefix} ${logEntry.ip} -> ${logEntry.method} ${logEntry.path}: ${logEntry.details}`);
  } else {
    console.info(`${prefix} ${logEntry.ip} -> ${logEntry.method} ${logEntry.path}: ${logEntry.details}`);
  }

  return logEntry;
}

export function getAuditLogs(limit = 50): SecurityLogEvent[] {
  return auditLogs.slice(0, Math.min(limit, auditLogs.length));
}

export function getSecurityStats() {
  return {
    totalRequestsAnalyzed,
    totalThreatsBlocked,
    activeEventsLogged: auditLogs.length,
    lastEventTimestamp: auditLogs[0]?.timestamp || null,
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

/**
 * Pipeline Violation Logger
 * 
 * Logs and monitors canon pipeline boundary violations
 * Provides visibility into attempted violations for compliance monitoring
 */

import type { PipelineBoundaryViolation } from './PipelineBoundaryGuard';

export interface ViolationLog {
  timestamp: string;
  pipeline: string;
  violation: string;
  attempted: string;
  route?: string;
  userId?: string;
  requestId?: string;
  severity: 'warning' | 'error' | 'critical';
}

class PipelineViolationLogger {
  private static instance: PipelineViolationLogger;
  private violations: ViolationLog[] = [];
  private readonly maxLogs = 1000; // Keep last 1000 violations in memory
  
  private constructor() {}
  
  static getInstance(): PipelineViolationLogger {
    if (!PipelineViolationLogger.instance) {
      PipelineViolationLogger.instance = new PipelineViolationLogger();
    }
    return PipelineViolationLogger.instance;
  }

  /**
   * Log a pipeline violation
   */
  logViolation(
    violation: PipelineBoundaryViolation,
    context?: {
      route?: string;
      userId?: string;
      requestId?: string;
    }
  ): void {
    const log: ViolationLog = {
      timestamp: new Date().toISOString(),
      pipeline: violation.pipeline,
      violation: violation.violation,
      attempted: violation.attemptedOperation,
      route: context?.route,
      userId: context?.userId,
      requestId: context?.requestId,
      severity: this.determineSeverity(violation)
    };
    
    // Add to in-memory log
    this.violations.push(log);
    
    // Trim to max size
    if (this.violations.length > this.maxLogs) {
      this.violations = this.violations.slice(-this.maxLogs);
    }
    
    // Log to console with formatting
    this.consoleLog(log);
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(log);
    }
  }

  /**
   * Get recent violations for monitoring dashboard
   */
  getRecentViolations(limit = 100): ViolationLog[] {
    return this.violations.slice(-limit);
  }

  /**
   * Get violation statistics
   */
  getViolationStats(): {
    total: number;
    byPipeline: Record<string, number>;
    bySeverity: Record<string, number>;
    last24h: number;
  } {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    const stats = {
      total: this.violations.length,
      byPipeline: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      last24h: 0
    };
    
    this.violations.forEach(log => {
      // By pipeline
      stats.byPipeline[log.pipeline] = (stats.byPipeline[log.pipeline] || 0) + 1;
      
      // By severity
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
      
      // Last 24h
      const logTime = new Date(log.timestamp).getTime();
      if (now - logTime <= day) {
        stats.last24h++;
      }
    });
    
    return stats;
  }

  /**
   * Clear violation logs (for testing)
   */
  clearLogs(): void {
    this.violations = [];
  }

  /**
   * Determine severity based on violation type
   */
  private determineSeverity(violation: PipelineBoundaryViolation): 'warning' | 'error' | 'critical' {
    // Critical violations that could corrupt data
    const criticalPatterns = [
      'attempting to modify substrate content',
      'creating substrate in wrong pipeline',
      'cross-pipeline write'
    ];
    
    // Error violations that break canon rules
    const errorPatterns = [
      'cannot interpret',
      'cannot create relationships',
      'is read-only'
    ];
    
    const violationText = violation.violation.toLowerCase();
    
    if (criticalPatterns.some(pattern => violationText.includes(pattern))) {
      return 'critical';
    }
    
    if (errorPatterns.some(pattern => violationText.includes(pattern))) {
      return 'error';
    }
    
    return 'warning';
  }

  /**
   * Console logging with color coding
   */
  private consoleLog(log: ViolationLog): void {
    const colors = {
      critical: '\x1b[31m', // Red
      error: '\x1b[33m',    // Yellow
      warning: '\x1b[36m'   // Cyan
    };
    const reset = '\x1b[0m';
    
    console.error(
      `${colors[log.severity]}[CANON VIOLATION - ${log.severity.toUpperCase()}]${reset}`,
      {
        timestamp: log.timestamp,
        pipeline: log.pipeline,
        violation: log.violation,
        attempted: log.attempted,
        route: log.route,
        userId: log.userId
      }
    );
  }

  /**
   * Send to monitoring service (placeholder)
   */
  private sendToMonitoring(log: ViolationLog): void {
    // In production, this would send to:
    // - Datadog/New Relic/Sentry
    // - Custom monitoring dashboard
    // - Slack alerts for critical violations
    
    if (log.severity === 'critical') {
      // Critical violations need immediate attention
      console.error('[CRITICAL CANON VIOLATION - ALERT REQUIRED]', log);
    }
  }
}

// Export singleton instance
export const violationLogger = PipelineViolationLogger.getInstance();

// Export monitoring endpoint data
export function getViolationMonitoringData() {
  const logger = PipelineViolationLogger.getInstance();
  
  return {
    recentViolations: logger.getRecentViolations(50),
    stats: logger.getViolationStats(),
    timestamp: new Date().toISOString()
  };
}
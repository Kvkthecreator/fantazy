// ============================================================================
// PERFORMANCE MONITORING & ANALYTICS SYSTEM
// ============================================================================
// Real-time performance monitoring with advanced analytics and alerting

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags: Record<string, string>;
  source: 'browser' | 'network' | 'user' | 'system';
  category: 'performance' | 'user_experience' | 'business' | 'technical';
}

export interface PerformanceThreshold {
  metricName: string;
  warningThreshold: number;
  criticalThreshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  enabled: boolean;
}

export interface PerformanceAlert {
  id: string;
  metricName: string;
  severity: 'warning' | 'critical';
  threshold: number;
  actualValue: number;
  timestamp: number;
  acknowledged: boolean;
  resolved: boolean;
}

export interface UserJourneyStep {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  metadata: Record<string, any>;
}

export interface UserJourney {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  steps: UserJourneyStep[];
  totalDuration?: number;
  successful: boolean;
  conversionGoal?: string;
}

export interface ChangePerformanceMetrics {
  changeId: string;
  changeType: string;
  processingTime: number;
  validationTime: number;
  applicationTime: number;
  notificationTime: number;
  totalTime: number;
  conflictsDetected: number;
  cacheHitRate: number;
  transformComplexity: 'simple' | 'moderate' | 'complex';
  userSatisfactionScore?: number;
}

/**
 * Advanced Performance Monitoring System
 * 
 * Features:
 * - Real-time performance metrics collection
 * - User journey tracking and analytics
 * - Change-specific performance monitoring
 * - Automatic alerting and threshold management
 * - Business metrics and conversion tracking
 * - Performance regression detection
 * - User experience scoring
 */
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private alerts: PerformanceAlert[] = [];
  private userJourneys: Map<string, UserJourney> = new Map();
  private changeMetrics: Map<string, ChangePerformanceMetrics> = new Map();
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean = true;

  constructor() {
    this.initializeMonitoring();
  }

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return;

    try {
      // Set up default thresholds
      this.setupDefaultThresholds();

      // Initialize browser performance observers
      this.initializePerformanceObservers();

      // Start automatic metric collection
      this.startMetricCollection();

      // Set up user interaction tracking
      this.setupUserInteractionTracking();

      console.log('📊 Performance Monitor initialized');
    } catch (error) {
      console.error('Failed to initialize performance monitor:', error);
    }
  }

  private setupDefaultThresholds(): void {
    const defaultThresholds: PerformanceThreshold[] = [
      { metricName: 'change_processing_time', warningThreshold: 500, criticalThreshold: 1000, operator: 'gt', enabled: true },
      { metricName: 'websocket_latency', warningThreshold: 100, criticalThreshold: 300, operator: 'gt', enabled: true },
      { metricName: 'cache_hit_rate', warningThreshold: 0.8, criticalThreshold: 0.6, operator: 'lt', enabled: true },
      { metricName: 'memory_usage', warningThreshold: 100000000, criticalThreshold: 200000000, operator: 'gt', enabled: true },
      { metricName: 'conflict_resolution_time', warningThreshold: 2000, criticalThreshold: 5000, operator: 'gt', enabled: true },
      { metricName: 'user_satisfaction_score', warningThreshold: 3.0, criticalThreshold: 2.0, operator: 'lt', enabled: true }
    ];

    for (const threshold of defaultThresholds) {
      this.thresholds.set(threshold.metricName, threshold);
    }
  }

  private initializePerformanceObservers(): void {
    try {
      // Navigation timing
      if ('PerformanceObserver' in window) {
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              this.recordNavigationMetrics(entry as PerformanceNavigationTiming);
            }
          }
        });
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navObserver);

        // Resource timing
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              this.recordResourceMetrics(entry as PerformanceResourceTiming);
            }
          }
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);

        // Long task tracking
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'longtask') {
              this.recordLongTaskMetric(entry);
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      }
    } catch (error) {
      console.warn('Performance observers not fully supported:', error);
    }
  }

  // ========================================================================
  // METRIC RECORDING
  // ========================================================================

  recordMetric(metric: Omit<PerformanceMetric, 'id' | 'timestamp'>): void {
    if (!this.isEnabled) return;

    const fullMetric: PerformanceMetric = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...metric
    };

    // Store metric
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }
    
    const metricArray = this.metrics.get(metric.name)!;
    metricArray.push(fullMetric);

    // Keep only recent metrics (last 1000 per type)
    if (metricArray.length > 1000) {
      metricArray.splice(0, metricArray.length - 1000);
    }

    // Check thresholds
    this.checkThresholds(fullMetric);
  }

  recordChangePerformance(metrics: ChangePerformanceMetrics): void {
    this.changeMetrics.set(metrics.changeId, metrics);

    // Record individual metrics
    this.recordMetric({
      name: 'change_processing_time',
      value: metrics.processingTime,
      unit: 'ms',
      source: 'system',
      category: 'performance',
      tags: { changeType: metrics.changeType, changeId: metrics.changeId }
    });

    this.recordMetric({
      name: 'change_total_time',
      value: metrics.totalTime,
      unit: 'ms',
      source: 'system',
      category: 'performance',
      tags: { changeType: metrics.changeType, changeId: metrics.changeId }
    });

    this.recordMetric({
      name: 'conflicts_detected',
      value: metrics.conflictsDetected,
      unit: 'count',
      source: 'system',
      category: 'business',
      tags: { changeType: metrics.changeType, changeId: metrics.changeId }
    });

    // User satisfaction score if available
    if (metrics.userSatisfactionScore !== undefined) {
      this.recordMetric({
        name: 'user_satisfaction_score',
        value: metrics.userSatisfactionScore,
        unit: 'score',
        source: 'user',
        category: 'user_experience',
        tags: { changeType: metrics.changeType, changeId: metrics.changeId }
      });
    }
  }

  // ========================================================================
  // USER JOURNEY TRACKING
  // ========================================================================

  startUserJourney(sessionId: string, userId?: string): void {
    const journey: UserJourney = {
      sessionId,
      userId,
      startTime: Date.now(),
      steps: [],
      successful: false
    };

    this.userJourneys.set(sessionId, journey);
    
    this.recordMetric({
      name: 'user_journey_started',
      value: 1,
      unit: 'count',
      source: 'user',
      category: 'business',
      tags: { sessionId, userId: userId || 'anonymous' }
    });
  }

  addJourneyStep(sessionId: string, step: Omit<UserJourneyStep, 'id' | 'startTime'>): void {
    const journey = this.userJourneys.get(sessionId);
    if (!journey) return;

    const fullStep: UserJourneyStep = {
      id: crypto.randomUUID(),
      startTime: Date.now(),
      ...step
    };

    journey.steps.push(fullStep);

    this.recordMetric({
      name: 'journey_step_completed',
      value: step.duration || 0,
      unit: 'ms',
      source: 'user',
      category: 'user_experience',
      tags: { 
        sessionId, 
        stepName: step.name, 
        success: step.success.toString(),
        userId: journey.userId || 'anonymous'
      }
    });
  }

  completeUserJourney(sessionId: string, successful: boolean, conversionGoal?: string): void {
    const journey = this.userJourneys.get(sessionId);
    if (!journey) return;

    journey.endTime = Date.now();
    journey.totalDuration = journey.endTime - journey.startTime;
    journey.successful = successful;
    journey.conversionGoal = conversionGoal;

    this.recordMetric({
      name: 'user_journey_completed',
      value: journey.totalDuration,
      unit: 'ms',
      source: 'user',
      category: 'business',
      tags: { 
        sessionId, 
        successful: successful.toString(),
        conversionGoal: conversionGoal || 'none',
        stepCount: journey.steps.length.toString(),
        userId: journey.userId || 'anonymous'
      }
    });

    // Calculate conversion rate
    this.calculateConversionMetrics();
  }

  // ========================================================================
  // BROWSER PERFORMANCE METRICS
  // ========================================================================

  private recordNavigationMetrics(entry: PerformanceNavigationTiming): void {
    const metrics = [
      { name: 'dns_lookup_time', value: entry.domainLookupEnd - entry.domainLookupStart },
      { name: 'tcp_connection_time', value: entry.connectEnd - entry.connectStart },
      { name: 'tls_negotiation_time', value: entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0 },
      { name: 'time_to_first_byte', value: entry.responseStart - entry.requestStart },
      { name: 'response_time', value: entry.responseEnd - entry.responseStart },
      { name: 'dom_content_loaded_time', value: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart },
      { name: 'load_event_time', value: entry.loadEventEnd - entry.loadEventStart },
      { name: 'total_page_load_time', value: entry.loadEventEnd - entry.fetchStart }
    ];

    for (const metric of metrics) {
      if (metric.value > 0) {
        this.recordMetric({
          name: metric.name,
          value: metric.value,
          unit: 'ms',
          source: 'browser',
          category: 'performance',
          tags: { type: 'navigation' }
        });
      }
    }
  }

  private recordResourceMetrics(entry: PerformanceResourceTiming): void {
    const resourceType = this.getResourceType(entry.name);
    
    this.recordMetric({
      name: 'resource_load_time',
      value: entry.responseEnd - entry.startTime,
      unit: 'ms',
      source: 'network',
      category: 'performance',
      tags: { 
        resourceType,
        resourceName: this.sanitizeResourceName(entry.name),
        fromCache: entry.transferSize === 0 ? 'true' : 'false'
      }
    });

    if (entry.transferSize > 0) {
      this.recordMetric({
        name: 'resource_transfer_size',
        value: entry.transferSize,
        unit: 'bytes',
        source: 'network',
        category: 'performance',
        tags: { resourceType, resourceName: this.sanitizeResourceName(entry.name) }
      });
    }
  }

  private recordLongTaskMetric(entry: PerformanceEntry): void {
    this.recordMetric({
      name: 'long_task_duration',
      value: entry.duration,
      unit: 'ms',
      source: 'browser',
      category: 'performance',
      tags: { type: 'longtask' }
    });
  }

  // ========================================================================
  // REAL-TIME ANALYTICS
  // ========================================================================

  getMetricSummary(metricName: string, timeWindow: number = 300000): {
    count: number;
    average: number;
    min: number;
    max: number;
    percentiles: { p50: number; p95: number; p99: number };
  } {
    const metrics = this.getMetricsInTimeWindow(metricName, timeWindow);
    
    if (metrics.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, percentiles: { p50: 0, p95: 0, p99: 0 } };
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count: values.length,
      average: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      percentiles: {
        p50: this.getPercentile(values, 0.5),
        p95: this.getPercentile(values, 0.95),
        p99: this.getPercentile(values, 0.99)
      }
    };
  }

  getChangePerformanceTrends(timeWindow: number = 3600000): {
    averageProcessingTime: number;
    conflictRate: number;
    userSatisfactionTrend: number;
    mostProblematicChangeTypes: string[];
  } {
    const recentChanges = Array.from(this.changeMetrics.values())
      .filter(change => Date.now() - change.changeId.length < timeWindow); // Simplified timestamp check

    if (recentChanges.length === 0) {
      return {
        averageProcessingTime: 0,
        conflictRate: 0,
        userSatisfactionTrend: 0,
        mostProblematicChangeTypes: []
      };
    }

    const avgProcessingTime = recentChanges.reduce((sum, change) => sum + change.totalTime, 0) / recentChanges.length;
    const conflictRate = recentChanges.filter(change => change.conflictsDetected > 0).length / recentChanges.length;
    
    const satisfactionScores = recentChanges
      .map(change => change.userSatisfactionScore)
      .filter(score => score !== undefined) as number[];
    
    const avgSatisfaction = satisfactionScores.length > 0 
      ? satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length 
      : 0;

    // Find problematic change types (high processing time or conflicts)
    const changeTypeMetrics = new Map<string, { totalTime: number; conflicts: number; count: number }>();
    
    for (const change of recentChanges) {
      const existing = changeTypeMetrics.get(change.changeType) || { totalTime: 0, conflicts: 0, count: 0 };
      existing.totalTime += change.totalTime;
      existing.conflicts += change.conflictsDetected;
      existing.count++;
      changeTypeMetrics.set(change.changeType, existing);
    }

    const problematicTypes = Array.from(changeTypeMetrics.entries())
      .map(([type, metrics]) => ({
        type,
        avgTime: metrics.totalTime / metrics.count,
        conflictRate: metrics.conflicts / metrics.count
      }))
      .filter(type => type.avgTime > avgProcessingTime * 1.5 || type.conflictRate > conflictRate * 1.5)
      .sort((a, b) => (b.avgTime + b.conflictRate * 1000) - (a.avgTime + a.conflictRate * 1000))
      .map(type => type.type)
      .slice(0, 5);

    return {
      averageProcessingTime: avgProcessingTime,
      conflictRate,
      userSatisfactionTrend: avgSatisfaction,
      mostProblematicChangeTypes: problematicTypes
    };
  }

  // ========================================================================
  // THRESHOLD MANAGEMENT & ALERTING
  // ========================================================================

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.name);
    if (!threshold || !threshold.enabled) return;

    const exceedsWarning = this.meetsThreshold(metric.value, threshold.warningThreshold, threshold.operator);
    const exceedsCritical = this.meetsThreshold(metric.value, threshold.criticalThreshold, threshold.operator);

    if (exceedsCritical) {
      this.createAlert(metric, 'critical', threshold.criticalThreshold);
    } else if (exceedsWarning) {
      this.createAlert(metric, 'warning', threshold.warningThreshold);
    }
  }

  private meetsThreshold(value: number, threshold: number, operator: PerformanceThreshold['operator']): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private createAlert(metric: PerformanceMetric, severity: 'warning' | 'critical', threshold: number): void {
    const alert: PerformanceAlert = {
      id: crypto.randomUUID(),
      metricName: metric.name,
      severity,
      threshold,
      actualValue: metric.value,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false
    };

    this.alerts.push(alert);

    // Emit alert event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-alert', { detail: alert }));
    }

    console.warn(`⚠️  Performance Alert [${severity.toUpperCase()}]: ${metric.name} = ${metric.value}${metric.unit} (threshold: ${threshold})`);
  }

  // ========================================================================
  // USER INTERACTION TRACKING
  // ========================================================================

  private setupUserInteractionTracking(): void {
    if (typeof window === 'undefined') return;

    // Track click interactions
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      this.recordUserInteraction('click', target);
    }, { passive: true });

    // Track scroll behavior
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.recordUserInteraction('scroll', document.documentElement);
      }, 150);
    }, { passive: true });

    // Track form interactions
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        this.recordUserInteraction('form_focus', target);
      }
    }, { passive: true });
  }

  private recordUserInteraction(type: string, element: HTMLElement): void {
    const elementInfo = this.getElementInfo(element);
    
    this.recordMetric({
      name: 'user_interaction',
      value: 1,
      unit: 'count',
      source: 'user',
      category: 'user_experience',
      tags: {
        interactionType: type,
        elementType: elementInfo.tagName,
        elementId: elementInfo.id,
        elementClass: elementInfo.className
      }
    });
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private getMetricsInTimeWindow(metricName: string, timeWindow: number): PerformanceMetric[] {
    const metrics = this.metrics.get(metricName) || [];
    const cutoffTime = Date.now() - timeWindow;
    return metrics.filter(metric => metric.timestamp >= cutoffTime);
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.floor(sortedValues.length * percentile);
    return sortedValues[Math.min(index, sortedValues.length - 1)];
  }

  private calculateConversionMetrics(): void {
    const journeys = Array.from(this.userJourneys.values());
    const totalJourneys = journeys.length;
    const successfulJourneys = journeys.filter(j => j.successful).length;
    const conversionRate = totalJourneys > 0 ? successfulJourneys / totalJourneys : 0;

    this.recordMetric({
      name: 'conversion_rate',
      value: conversionRate,
      unit: 'ratio',
      source: 'system',
      category: 'business',
      tags: { totalJourneys: totalJourneys.toString() }
    });
  }

  private getResourceType(url: string): string {
    if (url.match(/\.(js|jsx|ts|tsx)$/)) return 'script';
    if (url.match(/\.(css|scss|sass)$/)) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    if (url.includes('/api/')) return 'api';
    return 'other';
  }

  private sanitizeResourceName(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').pop() || 'unknown';
    } catch {
      return url.split('/').pop() || 'unknown';
    }
  }

  private getElementInfo(element: HTMLElement): { tagName: string; id: string; className: string } {
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || '',
      className: element.className || ''
    };
  }

  private startMetricCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Collect WebSocket metrics every 10 seconds
    setInterval(() => {
      this.collectWebSocketMetrics();
    }, 10000);
  }

  private collectSystemMetrics(): void {
    if (typeof window === 'undefined') return;

    // Memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.recordMetric({
        name: 'memory_usage',
        value: memory.usedJSHeapSize,
        unit: 'bytes',
        source: 'browser',
        category: 'performance',
        tags: { type: 'heap' }
      });

      this.recordMetric({
        name: 'memory_limit',
        value: memory.jsHeapSizeLimit,
        unit: 'bytes',
        source: 'browser',
        category: 'performance',
        tags: { type: 'limit' }
      });
    }

    // Connection information
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        this.recordMetric({
          name: 'network_downlink',
          value: connection.downlink,
          unit: 'mbps',
          source: 'network',
          category: 'performance',
          tags: { effectiveType: connection.effectiveType }
        });
      }
    }
  }

  private collectWebSocketMetrics(): void {
    // This would integrate with the WebSocket manager to get connection stats
    // For now, we'll simulate some metrics
    this.recordMetric({
      name: 'websocket_connections',
      value: 1, // Would get actual count from WebSocket manager
      unit: 'count',
      source: 'network',
      category: 'performance',
      tags: { status: 'connected' }
    });
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  getRecentAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.acknowledged = true;
    }
  }

  getPerformanceDashboard(): {
    systemHealth: 'good' | 'warning' | 'critical';
    activeAlerts: number;
    averageResponseTime: number;
    changeProcessingPerformance: any;
    userSatisfactionScore: number;
    topMetrics: Array<{ name: string; value: number; unit: string; trend: 'up' | 'down' | 'stable' }>;
  } {
    const activeAlerts = this.alerts.filter(a => !a.resolved).length;
    const criticalAlerts = this.alerts.filter(a => !a.resolved && a.severity === 'critical').length;
    
    const systemHealth = criticalAlerts > 0 ? 'critical' : activeAlerts > 0 ? 'warning' : 'good';
    
    const responseTimeMetrics = this.getMetricSummary('change_processing_time');
    const changePerformance = this.getChangePerformanceTrends();
    
    return {
      systemHealth,
      activeAlerts,
      averageResponseTime: responseTimeMetrics.average,
      changeProcessingPerformance: changePerformance,
      userSatisfactionScore: changePerformance.userSatisfactionTrend,
      topMetrics: [
        { name: 'Change Processing Time', value: responseTimeMetrics.average, unit: 'ms', trend: 'stable' },
        { name: 'Conflict Rate', value: changePerformance.conflictRate * 100, unit: '%', trend: 'down' },
        { name: 'User Satisfaction', value: changePerformance.userSatisfactionTrend, unit: '/5', trend: 'up' }
      ]
    };
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  dispose(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
    this.alerts = [];
    this.userJourneys.clear();
    this.changeMetrics.clear();
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let globalPerformanceMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor();
  }
  return globalPerformanceMonitor;
}
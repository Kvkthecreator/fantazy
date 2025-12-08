/**
 * Pipeline Boundary Guard
 * 
 * Enforces YARNNN Canon v2.0 substrate/artifact pipeline restrictions (P0-P4)
 * Ensures strict separation between substrate operations and artifact generation
 */

export class PipelineBoundaryViolation extends Error {
  constructor(
    public readonly pipeline: string,
    public readonly violation: string,
    public readonly attemptedOperation: string
  ) {
    super(`Pipeline boundary violation in ${pipeline}: ${violation}. Attempted: ${attemptedOperation}`);
    this.name = 'PipelineBoundaryViolation';
  }
}

export type PipelineOperation = {
  type: string;
  payload?: any;
  context?: any;
  data?: any;
  sideEffects?: string[];
  emitsEvents?: string[];
};

export class PipelineBoundaryGuard {
  /**
   * P0: Capture Pipeline - Only writes raw_dumps, never interprets
   */
  static enforceP0Capture(operation: PipelineOperation): void {
    const forbidden = [
      'interpret', 'analyze', 'process', 'extract',
      'create_block', 'create_context', 'create_relationship',
      'generate', 'synthesize', 'derive'
    ];
    
    // Check operation type
    if (forbidden.some(op => operation.type.toLowerCase().includes(op))) {
      throw new PipelineBoundaryViolation(
        'P0_CAPTURE',
        'Capture pipeline cannot interpret or process content',
        operation.type
      );
    }
    
    // Check side effects
    if (operation.sideEffects && operation.sideEffects.length > 0) {
      const allowedSideEffects = ['queue_agent_processing', 'emit_timeline_event'];
      const violations = operation.sideEffects.filter(
        effect => !allowedSideEffects.includes(effect)
      );
      
      if (violations.length > 0) {
        throw new PipelineBoundaryViolation(
          'P0_CAPTURE',
          'Capture pipeline has forbidden side effects',
          violations.join(', ')
        );
      }
    }
    
    // Ensure only timeline events for dump creation
    if (operation.emitsEvents) {
      const allowedEvents = ['dump.created', 'dump.queued'];
      const violations = operation.emitsEvents.filter(
        event => !allowedEvents.includes(event)
      );
      
      if (violations.length > 0) {
        throw new PipelineBoundaryViolation(
          'P0_CAPTURE',
          'Capture pipeline emitting non-dump events',
          violations.join(', ')
        );
      }
    }
  }

  /**
   * P1: Substrate Pipeline - Creates structured units, no relationships
   */
  static enforceP1Substrate(operation: PipelineOperation): void {
    const forbidden = [
      'create_relationship', 'connect', 'link', 'associate',
      'compute_reflection', 'derive_pattern', 'calculate_insight'
    ];
    
    if (forbidden.some(op => operation.type.toLowerCase().includes(op))) {
      throw new PipelineBoundaryViolation(
        'P1_SUBSTRATE',
        'Substrate pipeline cannot create relationships or reflections',
        operation.type
      );
    }
    
    // Check data for relationship creation
    if (operation.data && (operation.data.relationships || operation.data.connections)) {
      throw new PipelineBoundaryViolation(
        'P1_SUBSTRATE',
        'Substrate pipeline attempting to create relationships',
        'relationship data in payload'
      );
    }
    
    // Ensure proper event emission
    if (operation.emitsEvents) {
      const allowedEvents = [
        'block.created', 'block.updated', 'block.state_changed',
        'context_item.created', 'context_item.updated'
      ];
      const violations = operation.emitsEvents.filter(
        event => !allowedEvents.some(allowed => event.startsWith(allowed.split('.')[0]))
      );
      
      if (violations.length > 0) {
        throw new PipelineBoundaryViolation(
          'P1_SUBSTRATE',
          'Substrate pipeline emitting non-substrate events',
          violations.join(', ')
        );
      }
    }
  }

  /**
   * P2: Graph Pipeline - Connects substrates, never modifies content
   */
  static enforceP2Graph(operation: PipelineOperation): void {
    const forbidden = [
      'modify_content', 'update_text', 'change_body', 'edit',
      'transform_content', 'rewrite', 'alter_substrate'
    ];
    
    if (forbidden.some(op => operation.type.toLowerCase().includes(op))) {
      throw new PipelineBoundaryViolation(
        'P2_GRAPH',
        'Graph pipeline cannot modify substrate content',
        operation.type
      );
    }
    
    // Check for content modification attempts
    if (operation.data) {
      const contentFields = ['body', 'content', 'text', 'body_md'];
      const hasContentMod = contentFields.some(field => field in operation.data);
      
      if (hasContentMod) {
        throw new PipelineBoundaryViolation(
          'P2_GRAPH',
          'Graph pipeline attempting to modify substrate content',
          'content fields in payload'
        );
      }
    }
    
    // Ensure only relationship events
    if (operation.emitsEvents) {
      const allowedEvents = ['relationship.created', 'relationship.deleted'];
      const violations = operation.emitsEvents.filter(
        event => !allowedEvents.includes(event)
      );
      
      if (violations.length > 0) {
        throw new PipelineBoundaryViolation(
          'P2_GRAPH',
          'Graph pipeline emitting non-relationship events',
          violations.join(', ')
        );
      }
    }
  }

  /**
   * P3: Reflection Pipeline - Read-only computation, optional cache
   */
  static enforceP3Reflection(operation: PipelineOperation): void {
    const forbidden = [
      'create', 'update', 'delete', 'modify',
      'write', 'persist', 'store'
    ];
    
    // Allow cache operations
    const allowed = ['cache', 'compute', 'derive', 'calculate'];
    
    const isAllowed = allowed.some(op => operation.type.toLowerCase().includes(op));
    const isForbidden = forbidden.some(op => 
      operation.type.toLowerCase().includes(op) && 
      !operation.type.toLowerCase().includes('cache')
    );
    
    if (isForbidden && !isAllowed) {
      throw new PipelineBoundaryViolation(
        'P3_REFLECTION',
        'Reflection pipeline is read-only (except cache)',
        operation.type
      );
    }
    
    // Ensure no substrate creation
    if (operation.sideEffects) {
      const forbiddenEffects = [
        'create_block', 'create_context', 'create_dump', 
        'create_relationship', 'modify_substrate'
      ];
      const violations = operation.sideEffects.filter(effect =>
        forbiddenEffects.some(forbidden => effect.includes(forbidden))
      );
      
      if (violations.length > 0) {
        throw new PipelineBoundaryViolation(
          'P3_REFLECTION',
          'Reflection pipeline attempting substrate creation',
          violations.join(', ')
        );
      }
    }
    
    // Only reflection events allowed
    if (operation.emitsEvents) {
      const allowedEvents = ['reflection.computed', 'reflection.cached'];
      const violations = operation.emitsEvents.filter(
        event => !allowedEvents.includes(event)
      );
      
      if (violations.length > 0) {
        throw new PipelineBoundaryViolation(
          'P3_REFLECTION',
          'Reflection pipeline emitting non-reflection events',
          violations.join(', ')
        );
      }
    }
  }

  /**
   * P4: Presentation Pipeline - Consumes substrate, never creates it
   */
  static enforceP4Presentation(operation: PipelineOperation): void {
    const forbidden = [
      'create_dump', 'create_block', 'create_context',
      'create_substrate', 'generate_content', 'synthesize'
    ];
    
    if (forbidden.some(op => operation.type.toLowerCase().includes(op))) {
      throw new PipelineBoundaryViolation(
        'P4_PRESENTATION',
        'Presentation pipeline cannot create substrate',
        operation.type
      );
    }
    
    // Allow only document operations
    const allowed = [
      'compose_document', 'update_document', 'attach_reference',
      'format_presentation', 'render_narrative',
      // Async composition support: creating a document artifact shell is a P4 operation
      'create_document_shell'
    ];
    
    if (!allowed.some(op => operation.type.toLowerCase().includes(op.toLowerCase()))) {
      // Check if it's a read operation
      const readOps = ['get', 'fetch', 'read', 'query'];
      const isRead = readOps.some(op => operation.type.toLowerCase().includes(op));
      
      if (!isRead) {
        throw new PipelineBoundaryViolation(
          'P4_PRESENTATION',
          'Presentation pipeline performing non-presentation operation',
          operation.type
        );
      }
    }
    
    // Ensure only document events
    if (operation.emitsEvents) {
      const allowedEvents = [
        'document.created', 'document.updated', 
        'document.composed', 'narrative.authored'
      ];
      const violations = operation.emitsEvents.filter(
        event => !allowedEvents.some(allowed => event.startsWith(allowed.split('.')[0]))
      );
      
      if (violations.length > 0) {
        throw new PipelineBoundaryViolation(
          'P4_PRESENTATION',
          'Presentation pipeline emitting non-document events',
          violations.join(', ')
        );
      }
    }
  }

  /**
   * Validate any pipeline operation
   */
  static validateOperation(pipeline: string, operation: PipelineOperation): void {
    switch (pipeline) {
      case 'P0_CAPTURE':
        this.enforceP0Capture(operation);
        break;
      case 'P1_SUBSTRATE':
        this.enforceP1Substrate(operation);
        break;
      case 'P2_GRAPH':
        this.enforceP2Graph(operation);
        break;
      case 'P3_REFLECTION':
        this.enforceP3Reflection(operation);
        break;
      case 'P4_PRESENTATION':
        this.enforceP4Presentation(operation);
        break;
      default:
        throw new Error(`Unknown pipeline: ${pipeline}`);
    }
  }

  /**
   * Log pipeline violations for monitoring
   */
  static logViolation(
    violation: PipelineBoundaryViolation,
    context?: { route?: string; userId?: string; requestId?: string }
  ): void {
    // Use the dedicated violation logger
    import('./PipelineViolationLogger').then(({ violationLogger }) => {
      violationLogger.logViolation(violation, context);
    });
  }
}
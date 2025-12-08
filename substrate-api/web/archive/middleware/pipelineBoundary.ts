/**
 * Pipeline Boundary Middleware
 * 
 * Enforces canon pipeline boundaries at the API route level
 * Ensures all operations respect P0-P4 write restrictions
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  PipelineBoundaryGuard, 
  PipelineBoundaryViolation,
  type PipelineOperation 
} from '@/lib/canon/PipelineBoundaryGuard';

// Route to pipeline mapping - UPDATED FOR UNIVERSAL WORK ORCHESTRATION
const PIPELINE_ROUTES: Record<string, string> = {
  // Universal Work Orchestration - ALL substrate operations flow through here
  '/api/work': 'UNIVERSAL_ORCHESTRATION',
  
  // P0: Capture Pipeline
  '/api/dumps/upload': 'P0_CAPTURE',
  '/api/baskets/ingest': 'P0_CAPTURE',
  '/api/onboarding/complete': 'P0_CAPTURE',
  
  // Read-only endpoints (no governance needed)
  '/api/baskets/[id]/context-items': 'READ_ONLY',
  
  // P2: Graph Pipeline
  '/api/relationships': 'P2_GRAPH',
  '/api/relationships/create': 'P2_GRAPH',
  '/api/substrate-references': 'P2_GRAPH',
  
  // P3: Reflection Pipeline
  '/api/reflections': 'P3_REFLECTION',
  '/api/reflections/compute': 'P3_REFLECTION',
  '/api/reflections/cache': 'P3_REFLECTION',
  
  // P4: Presentation Pipeline
  '/api/documents': 'P4_PRESENTATION',
  '/api/documents/create': 'P4_PRESENTATION',
  '/api/documents/compose': 'P4_PRESENTATION',
  '/api/narrative': 'P4_PRESENTATION',
  
  // Legacy AI substrate creation endpoints (TO BE CONVERTED)
  '/api/intelligence/initialize': 'P1_SUBSTRATE_LEGACY',
  '/api/intelligence/generate/[basketId]': 'P1_SUBSTRATE_LEGACY'
};

// Extract operation from request
async function extractOperation(req: NextRequest): Promise<PipelineOperation> {
  const method = req.method || 'GET';
  const pathname = new URL(req.url).pathname;
  
  // Default operation type based on method and path
  let operationType = `${method.toLowerCase()}_${pathname.split('/').pop()}`;
  
  // Extract additional info from request body if available
  let data: any = {};
  let sideEffects: string[] = [];
  let emitsEvents: string[] = [];
  
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const body = await req.clone().json();
      data = body;
      
      // Detect operations from payload
      if (body.operation) {
        operationType = body.operation;
      }
      
      // Check for interpretation attempts in dumps
      if (pathname.includes('/dumps') && body.interpret) {
        operationType = 'interpret_dump';
      }
      
      // Check for relationship creation in substrate
      if (pathname.includes('/blocks') && body.relationships) {
        sideEffects.push('create_relationships');
      }
      
      // Detect content modification in graph operations
      if (pathname.includes('/relationships') && (body.content || body.body)) {
        operationType = 'modify_content';
      }
    } catch {
      // Body parsing failed, continue with defaults
    }
  }
  
  // Infer events based on operation
  if (operationType.includes('create')) {
    const resource = pathname.split('/').filter(Boolean).pop();
    emitsEvents.push(`${resource}.created`);
  }
  
  return {
    type: operationType,
    data,
    sideEffects,
    emitsEvents
  };
}

export async function pipelineBoundaryMiddleware(
  req: NextRequest,
  res: NextResponse
) {
  const pathname = new URL(req.url).pathname;
  
  // Find matching pipeline
  const pipeline = PIPELINE_ROUTES[pathname];
  
  if (!pipeline) {
    // Not a pipeline-protected route
    return NextResponse.next();
  }
  
  try {
    // Extract operation details
    const operation = await extractOperation(req);
    
    // Validate against pipeline boundaries
    PipelineBoundaryGuard.validateOperation(pipeline, operation);
    
    // Add pipeline header for downstream processing
    const response = NextResponse.next();
    response.headers.set('X-Pipeline', pipeline);
    response.headers.set('X-Canon-Validated', 'true');
    
    return response;
  } catch (error) {
    if (error instanceof PipelineBoundaryViolation) {
      // Log the violation
      PipelineBoundaryGuard.logViolation(error);
      
      // Return canon violation error
      return NextResponse.json(
        {
          error: 'Canon Violation',
          message: error.message,
          pipeline: error.pipeline,
          violation: error.violation,
          attempted: error.attemptedOperation
        },
        { status: 422 } // Unprocessable Entity
      );
    }
    
    // Other errors pass through
    throw error;
  }
}

// Helper to validate operations in API routes
export function validatePipelineOperation(
  pipeline: string,
  operation: PipelineOperation
): void {
  PipelineBoundaryGuard.validateOperation(pipeline, operation);
}

// Helper to get pipeline for current route
export function getCurrentPipeline(pathname: string): string | null {
  return PIPELINE_ROUTES[pathname] || null;
}

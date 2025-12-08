/**
 * YARNNN P4 Presentation Pipeline - Document Composer
 * 
 * Sacred Principle #3: "Narrative is Deliberate"
 * Documents = substrate references + authored prose
 * 
 * Canon v2.0 Compliance:
 * - P4 consumes pure substrates, generates document artifacts
 * - Substrate types: block, dump, context_item, timeline_event
 * - Reflections are artifacts, not substrate references
 */

import { createRouteHandlerClient } from "@/lib/supabase/clients";
import crypto from 'crypto';
import { PipelineBoundaryGuard } from "@/lib/canon/PipelineBoundaryGuard";
import { routeChange } from "@/lib/governance/decisionGateway";
import type { ChangeDescriptor } from "@/lib/governance/changeDescriptor";

export interface SubstrateReference {
  id: string;
  type: 'dump' | 'block' | 'context_item' | 'timeline_event';
  excerpt?: string;
  order: number;
}

export interface NarrativeSection {
  id: string;
  content: string;
  order: number;
  title?: string;
}

export interface DocumentComposition {
  title: string;
  substrate_references: SubstrateReference[];
  narrative_sections: NarrativeSection[];
  workspace_id: string;
  basket_id?: string;
  author_id: string;
  document_type?: string; // e.g., 'narrative' | 'plan' | 'brief'
  composition_context?: Record<string, any>; // intent, window, pinned, etc.
  composition_signature?: string; // duplication control hash
}

export interface ComposedDocument {
  id: string;
  title: string;
  composition: DocumentComposition;
  created_at: string;
  created_by: string;
}

export interface DocumentShellOptions {
  title: string;
  workspace_id: string;
  basket_id: string;
  author_id: string;
  composition_context?: Record<string, any>;
  initial_prose?: string;
}

/**
 * P4 Presentation Pipeline Implementation
 * 
 * Implements Sacred Principle #3: "Narrative is Deliberate"
 * - Documents compose substrate references plus authored prose
 * - Never creates substrate, only composes existing substrate
 * - Respects substrate equality (any type can be referenced)
 */
export class DocumentComposer {
  
  /**
   * Compose a document from substrate references + authored narrative
   * 
   * This is the canonical P4 operation that implements:
   * "Documents = substrate references + narrative"
   */
  static async composeDocument(
    composition: DocumentComposition,
    supabase: any
  ): Promise<{ success: boolean; document?: ComposedDocument; error?: string }> {
    
    try {
      // P4 Boundary Guard: Ensure we're only composing, not creating substrate
      PipelineBoundaryGuard.enforceP4Presentation({
        type: 'compose_document',
        data: composition,
        emitsEvents: ['document.composed', 'narrative.authored']
      });

      // Basic validation
      if (!composition.basket_id) {
        return { success: false, error: 'basket_id is required for document composition' };
      }

      if (!composition.narrative_sections || composition.narrative_sections.length === 0) {
        return { success: false, error: 'At least one narrative section is required' };
      }

      // Validate substrate references exist and are accessible
      const validationResult = await this.validateSubstrateReferences(
        composition.substrate_references,
        composition.workspace_id,
        supabase
      );

      if (!validationResult.valid) {
        return {
          success: false,
          error: `Invalid substrate references: ${validationResult.errors.join(', ')}`
        };
      }

      // Build raw content from narrative sections (ordered)
      const prose = [...composition.narrative_sections]
        .sort((a, b) => a.order - b.order)
        .map(s => s.content)
        .join('\n\n');

      // Compute composition signature (required)
      const normalized = {
        basket_id: composition.basket_id,
        document_type: composition.document_type || 'narrative',
        intent: (composition.composition_context as any)?.intent?.toString().trim().toLowerCase() || '',
        window: (composition.composition_context as any)?.window || null,
        pinned: (composition.composition_context as any)?.pinned || null,
      };
      const signatureInput = JSON.stringify(normalized);
      const computedSig = 'cmp_' + crypto.createHash('sha256').update(signatureInput).digest('hex').slice(0, 40);
      const signature = composition.composition_signature || computedSig;

      // Dedup gate: if a document with same signature exists in basket, use it and create new version
      let documentId: string | null = null;
      const { data: existingDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('basket_id', composition.basket_id)
        .contains('metadata', { composition_signature: signature })
        .limit(1);

      if (existingDocs && existingDocs.length > 0) {
        documentId = existingDocs[0].id;
      } else {
        // Create document artifact (P4-only)
        const { data: createdDocs, error: createErr } = await supabase
          .from('documents')
          .insert({
            basket_id: composition.basket_id,
            workspace_id: composition.workspace_id,
            title: composition.title,
            content_raw: prose,
            document_type: composition.document_type || 'narrative',
            metadata: {
              composition_context: composition.composition_context || {},
              composition_signature: signature,
              composition_type: 'substrate_plus_narrative'
            }
          })
          .select('id')
          .limit(1);

        if (createErr || !createdDocs || createdDocs.length === 0) {
          return { success: false, error: `Failed to create document: ${createErr?.message || 'unknown error'}` };
        }
        documentId = createdDocs[0].id;
      }

      // Canon Compliance: Store substrate references in document metadata (artifact)
      // P4 creates artifacts only, never substrate mutations
      const explicitRefs = [...composition.substrate_references];
      const substrateReferencesMetadata = explicitRefs.length > 0 
        ? explicitRefs.sort((a, b) => a.order - b.order).map(ref => ({
            substrate_type: ref.type,
            substrate_id: ref.id,
            role: 'reference',
            weight: 0.5,
            content_snippet: ref.excerpt || '',
            order: ref.order,
            attached_at: new Date().toISOString()
          }))
        : [];

      if (explicitRefs.length === 0) {
        // Canon Compliance: Auto-select blocks and store as artifact metadata
        try {
          const { data: blocks } = await supabase
            .from('blocks')
            .select('id, title, created_at, confidence_score, state')
            .eq('basket_id', composition.basket_id)
            .order('confidence_score', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(10);

          if (blocks && blocks.length) {
            let order = 0;
            for (const b of blocks) {
              if (b.state === 'REJECTED') continue;
              substrateReferencesMetadata.push({
                substrate_type: 'block',
                substrate_id: b.id,
                role: 'primary',
                weight: typeof (b as any).confidence_score === 'number' ? (b as any).confidence_score : 0.7,
                content_snippet: b.title || '',
                order: order++,
                attached_at: new Date().toISOString()
              });
            }
          }
        } catch (e) {
          console.warn('Auto-select substrate references failed:', e);
        }
      }

      // Canon Compliance: Update document metadata with substrate references (artifact-only)
      if (substrateReferencesMetadata.length > 0) {
        await supabase
          .from('documents')
          .update({
            metadata: {
              composition_context: composition.composition_context || {},
              composition_signature: signature,
              composition_type: 'substrate_plus_narrative',
              // Canon: Substrate references stored as document metadata (not substrate mutations)
              substrate_references: substrateReferencesMetadata
            }
          })
          .eq('id', documentId);
      }

      // Create initial version snapshot (idempotent by content hash)
      // Create version with composition contract and signature
      const versionMessage = existingDocs && existingDocs.length > 0 ? 'Recomposition' : 'Initial composition';
      // Load snapshots
      const { data: docRow } = await supabase.from('documents').select('*').eq('id', documentId).single();
      const { data: refsSnapshot } = await supabase
        .from('substrate_references')
        .select('*')
        .eq('document_id', documentId);

      const versionHash = 'doc_v' + crypto.createHash('sha256').update(prose).digest('hex').slice(0, 58);
      const composition_contract = {
        intent: normalized.intent,
        window: normalized.window,
        pinned: normalized.pinned,
        document_type: normalized.document_type,
        title: composition.title,
        tier: 'core'
      };

      // Insert version directly
      const { error: versionInsErr } = await supabase
        .from('document_versions')
        .insert({
          version_hash: versionHash,
          document_id: documentId,
          content: prose,
          metadata_snapshot: docRow?.metadata || {},
          substrate_refs_snapshot: refsSnapshot ? JSON.parse(JSON.stringify(refsSnapshot)) : [],
          version_message: versionMessage,
          parent_version_hash: docRow?.current_version_hash || null,
          composition_contract,
          composition_signature: signature
        });
      if (versionInsErr) {
        console.warn('Version insert failed:', versionInsErr.message);
      } else {
        await supabase
          .from('documents')
          .update({ current_version_hash: versionHash, updated_at: new Date().toISOString() })
          .eq('id', documentId);
      }

      // Fetch composed document for return
      if (!documentId) {
        return { success: false, error: 'Document ID missing after composition' };
      }

      const composed: ComposedDocument = {
        id: documentId as string,
        title: composition.title,
        composition,
        created_at: new Date().toISOString(),
        created_by: composition.author_id
      };

      return { success: true, document: composed };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown composition error'
      };
    }
  }

  /**
   * Create narrative-only document (authored prose without substrate references)
   */
  static async createNarrative(
    title: string,
    narrative_sections: NarrativeSection[],
    workspace_id: string,
    author_id: string,
    basket_id?: string,
    supabase?: any
  ): Promise<{ success: boolean; document?: ComposedDocument; error?: string }> {
    
    // This is still P4 but pure narrative (no substrate references)
    return this.composeDocument({
      title,
      substrate_references: [], // Pure narrative
      narrative_sections,
      workspace_id,
      basket_id,
      author_id
    }, supabase);
  }

  /**
   * Create document shell for async composition
   * 
   * Canon v2.1: Creates document immediately with pending composition status
   * for async P4_COMPOSE processing
   */
  static async createDocumentShell(
    options: DocumentShellOptions,
    supabase: any
  ): Promise<{ success: boolean; document?: ComposedDocument; error?: string }> {
    
    try {
      // P4 Boundary Guard: Document creation only
      PipelineBoundaryGuard.enforceP4Presentation({
        type: 'create_document_shell',
        data: options,
        emitsEvents: ['document.created']
      });

      // Compute composition signature for deduplication
      const normalized = {
        basket_id: options.basket_id,
        intent: options.composition_context?.intent?.toString().trim().toLowerCase() || '',
        window: options.composition_context?.window || null,
        pinned: options.composition_context?.pinned || null,
      };
      const signatureInput = JSON.stringify(normalized);
      const signature = 'cmp_' + crypto.createHash('sha256').update(signatureInput).digest('hex').slice(0, 40);

      // Create document with pending composition status
      const { data: createdDocs, error: createErr } = await supabase
        .from('documents')
        .insert({
          basket_id: options.basket_id,
          workspace_id: options.workspace_id,
          title: options.title,
          content_raw: options.initial_prose || '',
          document_type: 'narrative',
          metadata: {
            composition_context: options.composition_context || {},
            composition_signature: signature,
            composition_type: 'async_pending',
            composition_status: 'pending',
            composition_started_at: new Date().toISOString()
          }
        })
        .select('id, title, created_at, metadata')
        .limit(1);

      if (createErr || !createdDocs || createdDocs.length === 0) {
        return { success: false, error: `Failed to create document shell: ${createErr?.message || 'unknown error'}` };
      }

      const documentId = createdDocs[0].id;

      // Create initial version (empty composition)
      const versionHash = 'doc_v' + crypto.createHash('sha256').update(options.initial_prose || '').digest('hex').slice(0, 58);
      
      await supabase
        .from('document_versions')
        .insert({
          version_hash: versionHash,
          document_id: documentId,
          content: options.initial_prose || '',
          metadata_snapshot: createdDocs[0].metadata,
          substrate_refs_snapshot: [],
          version_message: 'Document shell - composition pending',
          composition_contract: options.composition_context,
          composition_signature: signature
        });

      // Update document with version
      await supabase
        .from('documents')
        .update({ current_version_hash: versionHash })
        .eq('id', documentId);

      const composed: ComposedDocument = {
        id: documentId,
        title: options.title,
        composition: {
          title: options.title,
          substrate_references: [],
          narrative_sections: options.initial_prose ? [{
            id: 'initial',
            content: options.initial_prose,
            order: 0
          }] : [],
          workspace_id: options.workspace_id,
          basket_id: options.basket_id,
          author_id: options.author_id,
          document_type: 'narrative',
          composition_context: options.composition_context
        },
        created_at: new Date().toISOString(),
        created_by: options.author_id
      };

      return { success: true, document: composed };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating document shell'
      };
    }
  }

  /**
   * Add substrate reference to existing document
   * 
   * P4 operation: consume existing substrate for composition
   */
  static async addSubstrateReference(
    document_id: string,
    substrate_ref: SubstrateReference,
    workspace_id: string,
    actor_id: string,
    supabase: any
  ): Promise<{ success: boolean; error?: string }> {
    
    try {
      PipelineBoundaryGuard.enforceP4Presentation({
        type: 'attach_reference',
        data: { document_id, substrate_ref },
        emitsEvents: ['document.updated']
      });

      // Validate the substrate reference exists
      const validationResult = await this.validateSubstrateReferences(
        [substrate_ref],
        workspace_id,
        supabase
      );

      if (!validationResult.valid) {
        return {
          success: false,
          error: `Invalid substrate reference: ${validationResult.errors.join(', ')}`
        };
      }

      // TODO: Canon v2.0 - Documents are artifacts, not substrates
      // This needs to be refactored to use P4 presentation pipeline instead of substrate governance
      return {
        success: false,
        error: 'Document reference addition temporarily disabled during canon v2.0 transition. Documents are now artifacts managed by P4 pipeline.'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add substrate reference'
      };
    }
  }

  /**
   * Validate that substrate references exist and are accessible
   * 
   * Ensures P4 only consumes existing substrate (never creates)
   */
  private static async validateSubstrateReferences(
    references: SubstrateReference[],
    workspace_id: string,
    supabase: any
  ): Promise<{ valid: boolean; errors: string[] }> {
    
    const errors: string[] = [];

    for (const ref of references) {
      try {
        let exists = false;

        // Check each substrate type (respecting substrate equality)
        switch (ref.type) {
          case 'dump':
            const { data: dump } = await supabase
              .from('raw_dumps')
              .select('id')
              .eq('id', ref.id)
              .eq('workspace_id', workspace_id)
              .single();
            exists = !!dump;
            break;

          case 'block':
            const { data: block } = await supabase
              .from('context_blocks')
              .select('id')
              .eq('id', ref.id)
              .eq('workspace_id', workspace_id)
              .single();
            exists = !!block;
            break;

          case 'context_item':
            const { data: item } = await supabase
              .from('context_items')
              .select('id')
              .eq('id', ref.id)
              .eq('workspace_id', workspace_id)
              .single();
            exists = !!item;
            break;

          case 'timeline_event':
            const { data: event } = await supabase
              .from('timeline_events')
              .select('id')
              .eq('id', ref.id)
              .eq('workspace_id', workspace_id)
              .single();
            exists = !!event;
            break;

          // Note: Reflections are now artifacts, not substrate references

          default:
            errors.push(`Unknown substrate type: ${ref.type}`);
            continue;
        }

        if (!exists) {
          errors.push(`Substrate reference not found: ${ref.type}:${ref.id}`);
        }

      } catch (error) {
        errors.push(`Failed to validate ${ref.type}:${ref.id} - ${error}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get document with resolved substrate references
   * 
   * P4 read operation: compose view without creating substrate
   */
  static async getDocumentWithReferences(
    document_id: string,
    workspace_id: string,
    supabase: any
  ): Promise<{ success: boolean; document?: any; error?: string }> {
    
    try {
      // Get document
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', document_id)
        .eq('workspace_id', workspace_id)
        .single();

      if (docError || !document) {
        return {
          success: false,
          error: 'Document not found'
        };
      }

      // Canon Compliance: Load substrate references from document metadata (artifact)
      // P4 documents store substrate references as metadata, not in substrate_references table
      const metadataRefs = document.metadata?.substrate_references || [];
      const references: SubstrateReference[] = metadataRefs.map((r: any) => ({
        id: r.substrate_id,
        type: r.substrate_type,
        order: r.order || 0,
        excerpt: r.content_snippet || undefined
      }));

      // Legacy fallback: Check substrate_references table for older documents
      if (references.length === 0) {
        const { data: refs } = await supabase
          .from('substrate_references')
          .select('substrate_id, substrate_type, metadata, snippets, role, weight, created_at')
          .eq('document_id', document_id)
          .order('created_at', { ascending: true });
        
        if (refs && refs.length > 0) {
          references.push(...refs.map((r: any, idx: number) => ({
            id: r.substrate_id,
            type: r.substrate_type,
            order: r.metadata?.order ?? idx,
            excerpt: Array.isArray(r.snippets) && r.snippets.length > 0 ? r.snippets[0] : undefined
          })));
        }
      }

      const resolvedRefs = await this.resolveSubstrateReferences(references, workspace_id, supabase);

      return {
        success: true,
        document: {
          ...document,
          resolved_substrate: resolvedRefs,
          composition_type: 'substrate_plus_narrative'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get document'
      };
    }
  }

  /**
   * Resolve substrate references for document composition
   * 
   * P4 operation: read substrate for composition (never modify)
   */
  private static async resolveSubstrateReferences(
    references: SubstrateReference[],
    workspace_id: string,
    supabase: any
  ): Promise<any[]> {
    
    const resolved = [];

    for (const ref of references) {
      try {
        let data = null;

        // Equal treatment for all substrate types (Sacred Principle #2)
        switch (ref.type) {
          case 'dump':
            const { data: dump } = await supabase
              .from('raw_dumps')
              .select('*')
              .eq('id', ref.id)
              .eq('workspace_id', workspace_id)
              .single();
            data = dump;
            break;

          case 'block':
            const { data: block } = await supabase
              .from('context_blocks')
              .select('*')
              .eq('id', ref.id)
              .eq('workspace_id', workspace_id)
              .single();
            data = block;
            break;

          case 'context_item':
            const { data: item } = await supabase
              .from('context_items')
              .select('*')
              .eq('id', ref.id)
              .eq('workspace_id', workspace_id)
              .single();
            data = item;
            break;

          case 'timeline_event':
            const { data: event } = await supabase
              .from('timeline_events')
              .select('*')
              .eq('id', ref.id)
              .eq('workspace_id', workspace_id)
              .single();
            data = event;
            break;

          // Note: Reflections are now artifacts, not substrate references
        }

        if (data) {
          resolved.push({
            reference: ref,
            substrate: data,
            resolved_at: new Date().toISOString()
          });
        }

      } catch (error) {
        console.warn(`Failed to resolve substrate reference ${ref.type}:${ref.id}`, error);
      }
    }

    return resolved;
  }
}

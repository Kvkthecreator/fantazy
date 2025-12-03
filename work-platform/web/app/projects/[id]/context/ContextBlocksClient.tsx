"use client";

/**
 * @deprecated LEGACY COMPONENT (2025-12-03)
 *
 * This component displays substrate blocks for knowledge extraction workflows.
 * It is NO LONGER used for work recipe context management.
 *
 * For work platform context, use ContextEntriesPanel instead.
 * See: /docs/architecture/ADR_CONTEXT_ENTRIES.md
 *
 * This component remains for:
 * - Knowledge extraction workflows
 * - RAG/semantic search use cases
 * - Legacy data viewing
 */

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  Database,
  Brain,
  Search,
  Loader2,
  AlertCircle,
  Plus,
  RefreshCw,
  Anchor,
  CheckCircle2,
  AlertTriangle,
  Users,
  Eye,
  TrendingUp,
  Target,
  MessageSquare,
  Compass,
  UserCheck,
  Clock,
  ArrowRight,
} from "lucide-react";
import { ProjectHealthCheck } from "@/components/projects/ProjectHealthCheck";
import BlockDetailModal from "@/components/context/BlockDetailModal";
import BlockFormModal from "@/components/context/BlockFormModal";

interface Block {
  id: string;
  title: string;
  content: string;
  semantic_type: string;
  state: string;
  confidence: number | null;
  times_referenced: number | null;
  created_at: string;
  anchor_role: string | null;
}

interface ContextBlocksClientProps {
  projectId: string;
  basketId: string;
  addRole?: string | null; // Pre-select anchor role and auto-open create modal
}

// Foundation roles that every project should ideally have
const FOUNDATION_ROLES = ["problem", "customer", "vision"];

// Insight roles that are agent-producible and refreshable
const INSIGHT_ROLES = [
  "trend_digest",
  "competitor_snapshot",
  "market_signal",
  "brand_voice",
  "strategic_direction",
  "customer_insight",
];

// Display config for all anchor roles
const ANCHOR_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; description: string; category: 'foundation' | 'insight' }> = {
  // Foundation roles
  problem: {
    label: "Problem",
    icon: AlertTriangle,
    description: "What pain point are you solving?",
    category: 'foundation',
  },
  customer: {
    label: "Customer",
    icon: Users,
    description: "Who is this for?",
    category: 'foundation',
  },
  vision: {
    label: "Vision",
    icon: Eye,
    description: "Where is this going?",
    category: 'foundation',
  },
  // Insight roles
  trend_digest: {
    label: "Trend Digest",
    icon: TrendingUp,
    description: "Industry trends and market movements",
    category: 'insight',
  },
  competitor_snapshot: {
    label: "Competitor Snapshot",
    icon: Target,
    description: "Competitive intelligence",
    category: 'insight',
  },
  market_signal: {
    label: "Market Signal",
    icon: Brain,
    description: "Research and market insights",
    category: 'insight',
  },
  brand_voice: {
    label: "Brand Voice",
    icon: MessageSquare,
    description: "Tone and style guidelines",
    category: 'insight',
  },
  strategic_direction: {
    label: "Strategic Direction",
    icon: Compass,
    description: "Strategic goals and priorities",
    category: 'insight',
  },
  customer_insight: {
    label: "Customer Insight",
    icon: UserCheck,
    description: "Deep customer understanding",
    category: 'insight',
  },
};

export default function ContextBlocksClient({ projectId, basketId, addRole }: ContextBlocksClientProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "knowledge" | "meaning">("all");
  const [isPolling, setIsPolling] = useState(false);
  const [pollingMessage, setPollingMessage] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAnchorRole, setCreateAnchorRole] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-open create modal with pre-selected anchor role when addRole is provided
  useEffect(() => {
    if (addRole && !loading) {
      setCreateAnchorRole(addRole);
      setShowCreateModal(true);
    }
  }, [addRole, loading]);

  // Fetch blocks from BFF
  const fetchBlocks = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/context`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `Failed to fetch context blocks (${response.status})`);
      }

      const data = await response.json();
      setBlocks(data.blocks || []);
      setError(null);
    } catch (err) {
      console.error("[Context Blocks] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to load context");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  // Refresh handler for manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBlocks(false);
  };

  // Handle successful create/edit
  const handleBlockSaved = () => {
    fetchBlocks(false);
  };

  // Handle successful delete
  const handleBlockDeleted = () => {
    fetchBlocks(false);
  };

  // Handle edit from detail modal
  const handleEditBlock = (block: Block) => {
    setEditingBlock(block);
  };

  // Polling logic for new blocks after context submission
  const startPolling = () => {
    const initialCount = blocks.length;
    setIsPolling(true);
    setPollingMessage("Processing context... checking for new blocks");

    let attempts = 0;
    const maxAttempts = 20; // 20 attempts * 3s = 60s max

    const pollInterval = setInterval(async () => {
      attempts++;

      try {
        // Fetch without setting loading state (silent poll)
        const response = await fetch(`/api/projects/${projectId}/context`);
        if (response.ok) {
          const data = await response.json();
          const newBlocks = data.blocks || [];

          if (newBlocks.length > initialCount) {
            // New blocks appeared!
            setBlocks(newBlocks);
            setIsPolling(false);
            setPollingMessage(`✓ ${newBlocks.length - initialCount} new block(s) added!`);
            clearInterval(pollInterval);

            // Clear success message after 5 seconds
            setTimeout(() => setPollingMessage(null), 5000);
            return;
          }
        }
      } catch (err) {
        console.error("[Context Blocks] Polling error:", err);
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        setIsPolling(false);
        setPollingMessage("Processing may still be in progress. Refresh to see updates.");

        // Clear timeout message after 8 seconds
        setTimeout(() => setPollingMessage(null), 8000);
      } else {
        // Update message with remaining time
        const remainingSeconds = (maxAttempts - attempts) * 3;
        setPollingMessage(`Processing context... (${remainingSeconds}s remaining)`);
      }
    }, 3000); // Poll every 3 seconds
  };

  // Semantic type categorization (matches P0-P4 pipeline output)
  const KNOWLEDGE_TYPES = ["fact", "metric", "event", "insight", "action", "finding", "quote", "summary"];
  const MEANING_TYPES = ["intent", "objective", "rationale", "principle", "assumption", "context", "constraint"];

  // Filter blocks
  const filteredBlocks = blocks.filter((block) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        block.title.toLowerCase().includes(query) ||
        block.content.toLowerCase().includes(query) ||
        block.semantic_type.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (filter === "knowledge") {
      return KNOWLEDGE_TYPES.includes(block.semantic_type.toLowerCase());
    }
    if (filter === "meaning") {
      return MEANING_TYPES.includes(block.semantic_type.toLowerCase());
    }

    return true;
  });

  // Stats
  const knowledgeCount = blocks.filter((b) =>
    KNOWLEDGE_TYPES.includes(b.semantic_type.toLowerCase())
  ).length;
  const meaningCount = blocks.filter((b) =>
    MEANING_TYPES.includes(b.semantic_type.toLowerCase())
  ).length;

  // Anchor role analysis - show which core roles are present vs missing
  const anchorBlocks = blocks.filter(b => b.anchor_role);
  const presentAnchorRoles = new Set(anchorBlocks.map(b => b.anchor_role!));

  // Foundation roles status
  const foundationStatus = FOUNDATION_ROLES.map(role => ({
    role,
    present: presentAnchorRoles.has(role),
    config: ANCHOR_CONFIG[role],
    block: anchorBlocks.find(b => b.anchor_role === role),
  }));
  const missingFoundation = foundationStatus.filter(f => !f.present);
  const foundationComplete = missingFoundation.length === 0;

  // Insight roles status
  const insightStatus = INSIGHT_ROLES.map(role => ({
    role,
    present: presentAnchorRoles.has(role),
    config: ANCHOR_CONFIG[role],
    block: anchorBlocks.find(b => b.anchor_role === role),
  })).filter(i => i.present); // Only show present insights

  if (loading) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading context blocks...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-8 w-8 text-destructive mb-4" />
          <p className="text-foreground font-medium">Failed to Load Context</p>
          <p className="text-muted-foreground text-sm mt-2">{error}</p>
          <p className="text-muted-foreground/80 text-xs mt-4">
            This may indicate that the basket doesn't exist in substrate-api yet, or there are connectivity issues.
          </p>
        </div>
      </Card>
    );
  }

  const pollingIntent = pollingMessage
    ? pollingMessage.startsWith('✓')
      ? 'success'
      : pollingMessage.startsWith('Processing may')
        ? 'warning'
        : 'info'
    : null;

  const pollingStyles: Record<string, string> = {
    success: 'border-surface-success-border bg-surface-success text-success-foreground',
    warning: 'border-surface-warning-border bg-surface-warning text-warning-foreground',
    info: 'border-surface-primary-border bg-surface-primary text-foreground',
  };

  return (
    <div className="space-y-6">
      {/* Project Health Check */}
      <ProjectHealthCheck projectId={projectId} basketId={basketId} />

      {/* Polling Status Message */}
      {pollingMessage && (
        <div className={cn('rounded-lg border p-4', pollingIntent ? pollingStyles[pollingIntent] : '')}>
          <div className="flex items-center gap-3">
            {isPolling && (
              <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{pollingMessage}</p>
          </div>
        </div>
      )}

      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">Context Blocks</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Block
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4">
        <Card className="flex-1 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted/60 p-2 text-muted-foreground">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{blocks.length}</p>
              <p className="text-xs text-muted-foreground">Total Blocks</p>
            </div>
          </div>
        </Card>
        <Card className="flex-1 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-surface-primary/70 p-2 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{knowledgeCount}</p>
              <p className="text-xs text-muted-foreground">Knowledge</p>
            </div>
          </div>
        </Card>
        <Card className="flex-1 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-surface-warning/70 p-2 text-warning-foreground">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{meaningCount}</p>
              <p className="text-xs text-muted-foreground">Meaning</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Foundation Anchors Status */}
      <Card className={cn(
        "p-4 transition-colors",
        foundationComplete
          ? "border-green-500/30 bg-green-500/5"
          : "border-yellow-500/30 bg-yellow-500/5"
      )}>
        <div className="flex items-center gap-3 mb-3">
          <div className={cn(
            "rounded-lg p-2",
            foundationComplete
              ? "bg-green-500/10 text-green-600"
              : "bg-yellow-500/10 text-yellow-600"
          )}>
            {foundationComplete ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <Anchor className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm">Core Anchors</h3>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  foundationComplete
                    ? "bg-green-500/10 text-green-700 border-green-500/30"
                    : "bg-yellow-500/10 text-yellow-700 border-yellow-500/30"
                )}
              >
                {foundationComplete ? "Complete" : `${3 - missingFoundation.length}/3`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {foundationComplete
                ? "All foundation anchors are defined"
                : "Define these to help agents understand your project"}
            </p>
          </div>
        </div>

        {/* Foundation roles checklist */}
        <div className="grid gap-2 sm:grid-cols-3">
          {foundationStatus.map(({ role, present, config, block }) => {
            if (!config) return null;
            const IconComponent = config.icon;

            return present ? (
              <div
                key={role}
                className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5 cursor-pointer hover:bg-green-500/10 transition-colors"
                onClick={() => block && setSelectedBlockId(block.id)}
              >
                <div className="rounded-md p-1.5 bg-green-500/10 text-green-600">
                  <IconComponent className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{config.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{block?.title}</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              </div>
            ) : (
              <button
                key={role}
                onClick={() => {
                  setCreateAnchorRole(role);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/50 transition-colors text-left"
              >
                <div className="rounded-md p-1.5 bg-yellow-500/10 text-yellow-600">
                  <IconComponent className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{config.label}</p>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Insight roles if any are present */}
        {insightStatus.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">
              Active insight anchors ({insightStatus.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {insightStatus.map(({ role, config, block }) => {
                if (!config) return null;
                const IconComponent = config.icon;

                return (
                  <button
                    key={role}
                    onClick={() => block && setSelectedBlockId(block.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-sm"
                  >
                    <IconComponent className="h-3.5 w-3.5 text-primary" />
                    <span className="text-foreground">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Search & Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search blocks by title, content, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "knowledge" ? "default" : "outline"}
            onClick={() => setFilter("knowledge")}
          >
            Knowledge
          </Button>
          <Button
            variant={filter === "meaning" ? "default" : "outline"}
            onClick={() => setFilter("meaning")}
          >
            Meaning
          </Button>
        </div>
      </div>

      {/* Blocks List */}
      {filteredBlocks.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No context blocks found</p>
            <p className="text-muted-foreground/80 text-sm mt-2">
              {searchQuery || filter !== "all"
                ? "Try adjusting your search or filters"
                : "Add content to your project to build substrate context"}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredBlocks.map((block) => (
            <Card
              key={block.id}
              className="p-4 cursor-pointer transition hover:border-ring hover:shadow-sm"
              onClick={() => setSelectedBlockId(block.id)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-medium text-foreground flex-1 line-clamp-2">
                  {block.title}
                </h3>
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  <Badge variant="outline">
                    {block.semantic_type}
                  </Badge>
                  {block.anchor_role && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1">
                      <Anchor className="h-3 w-3" />
                      {block.anchor_role}
                    </Badge>
                  )}
                  {block.state === 'PROPOSED' && (
                    <Badge variant="outline" className="bg-warning text-warning-foreground border-warning-foreground/50">
                      Pending Review
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                {block.content}
              </p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {block.confidence !== null && (
                  <span>{Math.round(block.confidence * 100)}% confidence</span>
                )}
                {block.times_referenced !== null && block.times_referenced > 0 && (
                  <span>{block.times_referenced} refs</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Block Detail Modal */}
      <BlockDetailModal
        blockId={selectedBlockId}
        projectId={projectId}
        basketId={basketId}
        open={selectedBlockId !== null}
        onClose={() => setSelectedBlockId(null)}
        onEdit={handleEditBlock}
        onDeleted={handleBlockDeleted}
      />

      {/* Create Block Modal */}
      <BlockFormModal
        projectId={projectId}
        basketId={basketId}
        defaultAnchorRole={createAnchorRole}
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateAnchorRole(null); // Reset anchor role when modal closes
        }}
        onSuccess={handleBlockSaved}
      />

      {/* Edit Block Modal */}
      <BlockFormModal
        projectId={projectId}
        basketId={basketId}
        block={editingBlock}
        open={editingBlock !== null}
        onClose={() => setEditingBlock(null)}
        onSuccess={handleBlockSaved}
      />
    </div>
  );
}

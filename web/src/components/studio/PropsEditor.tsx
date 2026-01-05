"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, FileText, Camera, Package, Mic, Smartphone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import type { EpisodeProp, PropType, PropRevealMode, PropCreate, PropUpdate } from "@/types";
import { cn } from "@/lib/utils";

interface PropsEditorProps {
  episodeId: string;
  episodeTitle: string;
}

const PROP_TYPES: { value: PropType; label: string; icon: typeof FileText }[] = [
  { value: "document", label: "Document", icon: FileText },
  { value: "photo", label: "Photo", icon: Camera },
  { value: "object", label: "Object", icon: Package },
  { value: "recording", label: "Recording", icon: Mic },
  { value: "digital", label: "Digital", icon: Smartphone },
];

const REVEAL_MODES: { value: PropRevealMode; label: string; description: string }[] = [
  { value: "automatic", label: "Automatic", description: "Revealed when turn count reaches hint" },
  { value: "character_initiated", label: "Character Initiated", description: "Character shows it naturally" },
  { value: "player_requested", label: "Player Requested", description: "Player must ask to see it" },
  { value: "gated", label: "Gated", description: "Requires prior prop or condition" },
];

const CONTENT_FORMATS = [
  { value: "none", label: "None" },
  { value: "handwritten", label: "Handwritten" },
  { value: "typed", label: "Typed" },
  { value: "printed", label: "Printed" },
  { value: "audio_transcript", label: "Audio Transcript" },
];

export function PropsEditor({ episodeId, episodeTitle }: PropsEditorProps) {
  const [props, setProps] = useState<EpisodeProp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [editingProp, setEditingProp] = useState<EpisodeProp | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState<Partial<PropCreate>>({
    name: "",
    slug: "",
    prop_type: "document",
    description: "",
    content: "",
    content_format: "",
    image_url: "",
    reveal_mode: "character_initiated",
    reveal_turn_hint: undefined,
    is_key_evidence: false,
    badge_label: "",
    evidence_tags: [],
  });

  // Load props on mount
  useEffect(() => {
    loadProps();
  }, [episodeId]);

  const loadProps = async () => {
    try {
      setLoading(true);
      const response = await api.episodeTemplates.getProps(episodeId);
      setProps(response.props);
      setError(null);
    } catch (err) {
      setError("Failed to load props");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      prop_type: "document",
      description: "",
      content: "",
      content_format: "",
      image_url: "",
      reveal_mode: "character_initiated",
      reveal_turn_hint: undefined,
      is_key_evidence: false,
      badge_label: "",
      evidence_tags: [],
    });
    setEditingProp(null);
    setIsCreating(false);
  };

  const startCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const startEdit = (prop: EpisodeProp) => {
    setFormData({
      name: prop.name,
      slug: prop.slug,
      prop_type: prop.prop_type,
      description: prop.description,
      content: prop.content || "",
      content_format: prop.content_format || "",
      image_url: prop.image_url || "",
      reveal_mode: prop.reveal_mode,
      reveal_turn_hint: prop.reveal_turn_hint ?? undefined,
      is_key_evidence: prop.is_key_evidence,
      badge_label: prop.badge_label || "",
      evidence_tags: prop.evidence_tags,
    });
    setEditingProp(prop);
    setIsCreating(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug || !formData.description) {
      setError("Name, slug, and description are required");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload = {
        ...formData,
        content: formData.content || null,
        content_format: formData.content_format || null,
        image_url: formData.image_url || null,
        badge_label: formData.badge_label || null,
        evidence_tags: formData.evidence_tags || [],
      };

      if (editingProp) {
        // Update existing prop
        await api.episodeTemplates.updateProp(episodeId, editingProp.id, payload as PropUpdate);
      } else {
        // Create new prop
        await api.episodeTemplates.createProp(episodeId, payload as PropCreate);
      }

      await loadProps();
      resetForm();
    } catch (err) {
      setError("Failed to save prop");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (propId: string) => {
    if (!confirm("Are you sure you want to delete this prop?")) return;

    try {
      await api.episodeTemplates.deleteProp(episodeId, propId);
      await loadProps();
    } catch (err) {
      setError("Failed to delete prop");
      console.error(err);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const getPropIcon = (type: PropType) => {
    const found = PROP_TYPES.find((t) => t.value === type);
    return found?.icon || FileText;
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-medium">Props</span>
          <span className="text-sm text-muted-foreground">({props.length})</span>
        </div>
        <span className="text-xs text-muted-foreground">ADR-005: Canonical Story Objects</span>
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Props list */}
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading props...</div>
          ) : props.length === 0 && !isCreating && !editingProp ? (
            <div className="text-sm text-muted-foreground">
              No props defined for this episode. Props are canonical story objects (evidence, letters, photos) that maintain consistency.
            </div>
          ) : (
            <div className="space-y-2">
              {props.map((prop) => {
                const Icon = getPropIcon(prop.prop_type);
                const isEditing = editingProp?.id === prop.id;

                if (isEditing) return null; // Show form instead

                return (
                  <div
                    key={prop.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        prop.is_key_evidence
                          ? "bg-amber-500/20 text-amber-600"
                          : "bg-muted text-muted-foreground"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{prop.name}</span>
                          {prop.is_key_evidence && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 uppercase tracking-wider">
                              {prop.badge_label || "Key Evidence"}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {prop.reveal_mode} • Turn {prop.reveal_turn_hint ?? "any"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(prop)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(prop.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create/Edit form */}
          {(isCreating || editingProp) && (
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
              <div className="font-medium">
                {editingProp ? "Edit Prop" : "New Prop"}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    value={formData.name || ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData({
                        ...formData,
                        name,
                        slug: formData.slug || generateSlug(name),
                      });
                    }}
                    placeholder="The Yellow Note"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-1">
                  <Label>Slug</Label>
                  <Input
                    value={formData.slug || ""}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="yellow-note"
                  />
                </div>
              </div>

              {/* Type and Reveal Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select
                    value={formData.prop_type}
                    onValueChange={(v) => setFormData({ ...formData, prop_type: v as PropType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROP_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Reveal Mode</Label>
                  <Select
                    value={formData.reveal_mode}
                    onValueChange={(v) => setFormData({ ...formData, reveal_mode: v as PropRevealMode })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REVEAL_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {REVEAL_MODES.find((m) => m.value === formData.reveal_mode)?.description}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label>Description</Label>
                <textarea
                  className="min-h-[60px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="A torn piece of yellow legal paper with hasty handwriting..."
                />
              </div>

              {/* Content (optional canonical text) */}
              <div className="space-y-1">
                <Label>Content (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Exact canonical text on the prop (if any). This is immutable once authored.
                </p>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                  value={formData.content || ""}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="I have to finish this or he'll never stop watching us..."
                />
              </div>

              {/* Content Format and Turn Hint */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Content Format</Label>
                  <Select
                    value={formData.content_format || "none"}
                    onValueChange={(v) => setFormData({ ...formData, content_format: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_FORMATS.map((format) => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Reveal Turn Hint</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.reveal_turn_hint ?? ""}
                    onChange={(e) => setFormData({
                      ...formData,
                      reveal_turn_hint: e.target.value ? parseInt(e.target.value) : undefined,
                    })}
                    placeholder="e.g., 3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Turn number when prop should be revealed (for automatic mode)
                  </p>
                </div>
              </div>

              {/* Image URL */}
              <div className="space-y-1">
                <Label>Image URL (optional)</Label>
                <Input
                  value={formData.image_url || ""}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              {/* Key Evidence and Badge Label */}
              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_key_evidence || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_key_evidence: checked })}
                  />
                  <div>
                    <Label>Key Evidence</Label>
                    <p className="text-xs text-muted-foreground">Mark as important story element</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Badge Label</Label>
                  <Input
                    value={formData.badge_label || ""}
                    onChange={(e) => setFormData({ ...formData, badge_label: e.target.value })}
                    placeholder="e.g., Keepsake, Critical Intel"
                  />
                  <p className="text-xs text-muted-foreground">
                    Custom badge text (default: "Key Evidence")
                  </p>
                </div>
              </div>

              {/* Evidence Tags */}
              <div className="space-y-1">
                <Label>Evidence Tags</Label>
                <Input
                  value={(formData.evidence_tags || []).join(", ")}
                  onChange={(e) => setFormData({
                    ...formData,
                    evidence_tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                  })}
                  placeholder="inciting_incident, timeline, suspect_A"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated tags for categorization
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : editingProp ? "Update Prop" : "Create Prop"}
                </Button>
              </div>
            </div>
          )}

          {/* Add button */}
          {!isCreating && !editingProp && (
            <Button variant="outline" size="sm" onClick={startCreate} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Prop
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

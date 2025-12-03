/**
 * API Route: GET /api/recipes
 *
 * Fetches available work recipes from database.
 * Returns only recipes with proper agent support and valid configurations.
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/clients";

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user session for auth
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch all active recipes from database
    const { data: recipes, error } = await supabase
      .from('work_recipes')
      .select(`
        id,
        name,
        slug,
        description,
        agent_type,
        version,
        configurable_parameters,
        output_specification,
        status
      `)
      .eq('status', 'active')
      .order('agent_type', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error("[API] Failed to fetch recipes:", error);
      return NextResponse.json(
        { detail: "Failed to fetch recipes" },
        { status: 500 }
      );
    }

    // Transform database recipes to frontend format
    const transformedRecipes = (recipes || []).map((recipe: any) => {
      // Parse configurable_parameters JSON
      const params = recipe.configurable_parameters || {};
      const outputSpec = recipe.output_specification || {};

      // Determine output format from output_specification.format
      // Format values: pptx, markdown, text, brand_guidelines, competitive_analysis, structured_analysis
      const rawFormat = outputSpec.format || params.output_format?.default || 'text';

      // Map format to display badge
      const formatDisplayMap: Record<string, string> = {
        'pptx': 'PPTX',
        'markdown': 'MD',
        'text': 'TXT',
        'brand_guidelines': 'DOC',
        'competitive_analysis': 'DOC',
        'structured_analysis': 'DOC',
      };
      const outputFormat = formatDisplayMap[rawFormat] || rawFormat.toUpperCase();

      return {
        id: recipe.slug, // Use slug as ID for URL routing
        db_id: recipe.id, // Keep UUID for API calls
        name: recipe.name,
        description: recipe.description || `${recipe.name} recipe`,
        agent_type: recipe.agent_type,
        output_format: outputFormat,
        version: recipe.version,
        parameters: params,
        // Add metadata for frontend rendering
        popular: recipe.agent_type === 'reporting', // Mark reporting as popular for now
        color: recipe.agent_type === 'reporting' ? 'blue' :
               recipe.agent_type === 'research' ? 'purple' : 'indigo',
      };
    });

    return NextResponse.json({
      recipes: transformedRecipes,
      count: transformedRecipes.length,
    });

  } catch (error: any) {
    console.error("[API] Recipes endpoint failed:", error);
    return NextResponse.json(
      { detail: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

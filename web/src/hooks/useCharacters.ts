"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import type { CharacterSummary, Character, RelationshipWithCharacter } from "@/types";

export function useCharacters() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadCharacters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.characters.list();
      setCharacters(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  return { characters, isLoading, error, reload: loadCharacters };
}

export function useCharacter(idOrSlug: string) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadCharacter = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try UUID first, then slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      const data = isUUID
        ? await api.characters.get(idOrSlug)
        : await api.characters.getBySlug(idOrSlug);
      setCharacter(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [idOrSlug]);

  useEffect(() => {
    loadCharacter();
  }, [loadCharacter]);

  return { character, isLoading, error, reload: loadCharacter };
}

export function useRelationships() {
  const [relationships, setRelationships] = useState<RelationshipWithCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRelationships = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.relationships.list();
      setRelationships(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  return { relationships, isLoading, error, reload: loadRelationships };
}

export function useCharacterProfile(slug: string) {
  const [profile, setProfile] = useState<import("@/types").CharacterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.characters.getProfile(slug);
      setProfile(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return { profile, isLoading, error, reload: loadProfile };
}

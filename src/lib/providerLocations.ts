export const PROVIDER_LOCATIONS: Record<string, { lat: number; lng: number; color: string }> = {
  anthropic:  { lat: 37.77, lng: -122.42, color: "#FF6B35" },
  openai:     { lat: 37.79, lng: -122.40, color: "#10B981" },
  openrouter: { lat: 37.75, lng: -122.44, color: "#8B5CF6" },
  ollama:     { lat: 0, lng: 0, color: "#67E8F9" },
  google:     { lat: 37.42, lng: -122.08, color: "#60A5FA" },
};

export const USER_LOCATION = { lat: 40.71, lng: -74.01 };

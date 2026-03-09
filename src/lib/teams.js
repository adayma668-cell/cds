export const TEAMS = [
  { id: "ai_ml", label: "AI/ML Team", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: "spt", label: "SPT Team", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "marketing", label: "Marketing Team", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "it", label: "IT Team", color: "bg-teal-100 text-teal-700 border-teal-200" },
];

export function getTeamLabel(id) {
  return TEAMS.find((t) => t.id === id)?.label || id;
}

export function getTeamColor(id) {
  return TEAMS.find((t) => t.id === id)?.color || "bg-gray-100 text-gray-600 border-gray-200";
}

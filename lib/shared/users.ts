export const USERS = [
  { id: "rino", name: "Rino", color: "#22d3ee", textColor: "#001016" },
  { id: "iselin", name: "Iselin", color: "#f59e0b", textColor: "#1f1300" },
  { id: "fia", name: "Fia", color: "#a3e635", textColor: "#132000" },
  { id: "rakel", name: "Rakel", color: "#fb7185", textColor: "#22040a" },
  { id: "hugo", name: "Hugo", color: "#818cf8", textColor: "#060c25" },
] as const;

export type User = (typeof USERS)[number];
export type UserId = User["id"];

export function isUserId(value: string | null | undefined): value is UserId {
  if (!value) {
    return false;
  }
  return USERS.some((user) => user.id === value);
}

export function findUser(userId: UserId) {
  return USERS.find((user) => user.id === userId);
}

export type Category = "Strength" | "Mobility" | "Pilates";
export type Creator = {
  id: string;
  name: string;
  handle: string;
  category: Category;
  tagline: string;
  bio: string;
  photo: string;
  price: number;
  published: boolean;
  payoutReady: boolean;
};
export type Workout = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  minutes: number;
  equipment: string;
  level: string;
  free: boolean;
  published: boolean;
  video: string;
  photo: string;
};
export type Program = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  weeks: number;
  workoutIds: string[];
  published: boolean;
};
export type Membership = {
  creatorId: string;
  price: number;
  renews: boolean;
  started: string;
  ends: string;
};
export type AppState = {
  version: 1;
  user: { name: string; email: string } | null;
  creators: Creator[];
  workouts: Workout[];
  programs: Program[];
  memberships: Membership[];
  completed: Record<string, string>;
  saved: string[];
  supports: { id: string; message: string; date: string }[];
  ownedId: string | null;
};
export const photos = {
  strength:
    "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&q=85&fit=crop",
  mobility:
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1000&q=85&fit=crop",
  pilates:
    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1000&q=85&fit=crop",
  workout:
    "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=1000&q=85&fit=crop",
};
// Bundled sample clip; replace with coach-owned workout media.
export const SAMPLE_VIDEO = "trainwith:sample-session";
export function seed(): AppState {
  const creators: Creator[] = [
    {
      id: "maya",
      name: "Maya Chen",
      handle: "trainwithmaya",
      category: "Strength",
      tagline: "Stronger for your everyday.",
      bio: "Simple, effective strength sessions for busy people. A little time, a pair of dumbbells, and a stronger you.",
      photo: photos.strength,
      price: 19,
      published: true,
      payoutReady: true,
    },
    {
      id: "alex",
      name: "Alex Rivera",
      handle: "alexmoves",
      category: "Mobility",
      tagline: "Move better. Feel better.",
      bio: "Build a little more freedom into every day with approachable mobility and recovery sessions.",
      photo: photos.mobility,
      price: 15,
      published: true,
      payoutReady: true,
    },
    {
      id: "ella",
      name: "Ella Brooks",
      handle: "ellaflow",
      category: "Pilates",
      tagline: "Find your kind of balance.",
      bio: "Low-impact Pilates, thoughtful movement, and time to reconnect with yourself.",
      photo: photos.pilates,
      price: 17,
      published: true,
      payoutReady: true,
    },
  ];
  const workouts: Workout[] = creators.flatMap((c) =>
    [
      "Your first 20 minutes",
      c.category === "Strength"
        ? "Full-body foundations"
        : c.category === "Mobility"
          ? "Morning mobility"
          : "Find your flow",
      c.category === "Strength"
        ? "Lower-body strength"
        : c.category === "Mobility"
          ? "Hips & shoulders"
          : "Core & control",
      "The everyday reset",
    ].map((title, i) => ({
      id: `${c.id}-${i}`,
      creatorId: c.id,
      title,
      description:
        i === 0
          ? "Get to know your coach with a free introductory session. Move at your own pace."
          : "A focused session to help you build consistency. Follow along, pause when you need, and make it your own.",
      minutes: [20, 24, 22, 18][i],
      equipment: c.category === "Strength" ? "Dumbbells" : "Mat",
      level: "Beginner",
      free: i === 0,
      published: true,
      video: SAMPLE_VIDEO,
      photo: c.photo,
    })),
  );
  return {
    version: 1,
    user: null,
    creators,
    workouts,
    programs: creators.map((c) => ({
      id: `${c.id}-program`,
      creatorId: c.id,
      title:
        c.id === "maya"
          ? "Everyday Strength"
          : c.id === "alex"
            ? "Move Freely"
            : "A Little More Balance",
      description:
        "A simple weekly rhythm. Three sessions to come back to, with room for real life in between.",
      weeks: 4,
      workoutIds: [1, 2, 3].map((i) => `${c.id}-${i}`),
      published: true,
    })),
    memberships: [],
    completed: {},
    saved: [],
    supports: [],
    ownedId: null,
  };
}
/** Deliberately permissive: catches typos without rejecting valid addresses. */
export const EMAIL = /^\S+@\S+\.\S+$/;
export const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
export function hasAccess(state: AppState, creatorId: string) {
  return state.memberships.some(
    (m) => m.creatorId === creatorId && new Date(m.ends).getTime() > Date.now(),
  );
}
export function handleError(
  handle: string,
  creators: Creator[],
  ownId?: string,
) {
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(handle))
    return "Use 3–24 lowercase letters, numbers, or underscores. Start with a letter.";
  if (
    [
      "studio",
      "profile",
      "discover",
      "workouts",
      "support",
      "join",
      "admin",
      "settings",
      "auth",
      "screen",
      "membership",
    ].includes(handle)
  )
    return "This handle is reserved. Try another.";
  if (creators.some((c) => c.handle === handle && c.id !== ownId))
    return "That handle is already taken.";
  return "";
}
export function publishChecks(s: AppState, c: Creator) {
  return [
    {
      label: "Add your channel profile",
      ok: !!(c.name.trim() && c.tagline.trim() && c.bio.trim()),
    },
    {
      label: "Publish a free sample",
      ok: s.workouts.some(
        (w) => w.creatorId === c.id && w.free && w.published && w.video,
      ),
    },
    {
      label: "Publish a member workout",
      ok: s.workouts.some(
        (w) => w.creatorId === c.id && !w.free && w.published && w.video,
      ),
    },
    { label: "Set your monthly price", ok: c.price >= 1 },
    { label: "Complete payout setup", ok: c.payoutReady },
  ];
}

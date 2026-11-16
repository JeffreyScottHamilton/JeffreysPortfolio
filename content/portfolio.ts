import type { Media } from "./media";
export type Project = {
  id: string;
  name: string;
  description: string;
  category: string;
  live?: string;
  source?: string;
  preview: Media;
};
const preview = (
  id: string,
  alt: string,
  status: Media["status"] = "ready",
  src?: string,
  source = "Original portfolio screenshot",
): Media => ({
  id,
  src: src ?? (status === "ready" ? `/previews/${id}.png` : undefined),
  alt,
  source,
  focal: "50% 50%",
  status,
});
export const projects: Project[] = [
  {
    id: "plainkit",
    name: "Plainkit",
    description: "Browser tools that process files on your device.",
    category: "Browser tools",
    live: "https://plain-kit.vercel.app/",
    preview: preview(
      "plainkit",
      "Plainkit’s current dark browser tools workspace",
      "ready",
      undefined,
      "Captured from verified live site, November 2026",
    ),
  },
  {
    id: "bedulo",
    name: "Bedulo",
    description:
      "Talk for a few minutes each night; Bedulo writes a page in your book.",
    category: "A little reflection",
    live: "https://bedulo.com/",
    preview: preview(
      "bedulo",
      "Bedulo cream ruled journal and teal microphone",
      "ready",
      undefined,
      "Supplied by owner, November 2026",
    ),
  },
  {
    id: "slate",
    name: "Slate",
    description: "Collaborative whiteboard and 3D editor.",
    category: "Creative tools",
    live: "https://slate-client.vercel.app/",
    preview: preview(
      "slate",
      "Slate editor with purple perspective grid, white mesh and sidebars",
    ),
  },
  {
    id: "pollly",
    name: "Pollly",
    description: "A social app where every post is a question.",
    category: "Social",
    live: "https://pollly-eosin.vercel.app/",
    preview: preview("pollly", "Pollly feed with question posts"),
  },
  {
    id: "bulletin",
    name: "Bulletin",
    description: "Local classifieds with private replies.",
    category: "Community",
    live: "https://bulletin-classifieds.vercel.app/",
    preview: preview("bulletin", "Bulletin preview coming soon", "missing"),
  },
  {
    id: "counterpoint",
    name: "Counterpoint",
    description: "Sharpen your thinking through different perspectives.",
    category: "Different perspectives",
    live: "https://counterpoint-six.vercel.app/",
    preview: preview("counterpoint", "Counterpoint public entry view"),
  },
  {
    id: "violethour",
    name: "Violet Hour",
    description: "An editor theme for Visual Studio and VS Code.",
    category: "Developer tools",
    live: "https://marketplace.visualstudio.com/items?itemName=jeffreyhamilton.violet-hour",
    preview: preview(
      "violethour",
      "Violet Hour syntax colors in the code editor",
    ),
  },
  {
    id: "modrinth",
    name: "Minecraft Mods",
    description: "Fabric projects. Small ideas, new possibilities.",
    category: "Minecraft / Fabric",
    live: "https://modrinth.com/user/JeffreyHamilton",
    preview: preview(
      "modrinth",
      "Jeffrey Hamilton’s real Modrinth mod collection",
    ),
  },
  {
    id: "signalsurf",
    name: "Signal surf",
    description: "An idea taking shape. More when it’s ready.",
    category: "Planned / unbuilt",
    preview: preview("signalsurf", "Planned project", "planned"),
  },
  {
    id: "ultimatum",
    name: "Ultimatum",
    description: "Free, open-source developer skill/plugin for Claude Code.",
    category: "Open source",
    source: "https://github.com/JeffreyScottHamilton/Ultimatum",
    preview: preview(
      "ultimatum",
      "The real Ultimatum GitHub repository",
      "ready",
      undefined,
      "Captured from verified GitHub repository, November 2026",
    ),
  },
  {
    id: "buddy",
    name: "Buddy",
    description: "Offline AI desktop companion.",
    category: "Desktop / AI",
    live: "https://jeffreyhamilton6399.github.io/buddy-desktop",
    preview: preview("buddy", "Buddy’s real orb, chat and desktop preview"),
  },
  {
    id: "sprintdeck",
    name: "SprintDeck",
    description:
      "A collaborative Scrum workspace for boards, backlogs and sprints.",
    category: "Project management",
    live: "https://sprintdeck-nine.vercel.app",
    preview: preview(
      "sprintdeck",
      "SprintDeck landing page with its To do / In progress / Done board",
      "ready",
      undefined,
      "Captured from verified live site, November 2026",
    ),
  },
];
export const certificates = [
  ["computer-programming-1", "Computer Programming 1", "May 12, 2025"],
  [
    "computer-programming-2-java",
    "Computer Programming 2 Java",
    "December 18, 2025",
  ],
  [
    "game-development-fundamentals",
    "Game Development Fundamentals",
    "December 12, 2024",
  ],
  ["digital-media-1", "Digital Media 1", "December 5, 2024"],
  ["digital-media-2", "Digital Media 2", "May 4, 2026"],
  ["robotics-1", "Robotics 1", "December 15, 2025"],
  ["unmanned-aerial-systems", "Unmanned Aerial Systems", "December 18, 2025"],
  [
    "cad-architectural-design-1",
    "CAD Architectural Design I",
    "December 19, 2023",
  ],
  ["architectural-design-2", "Architectural Design 2", "May 9, 2025"],
  ["claude-101", "Claude 101", "November 16, 2026", "/certificates/claude-101.pdf"],
  [
    "claude-code-101",
    "Claude Code 101",
    "November 16, 2026",
    "/certificates/claude-code-101.pdf",
  ],
].map(([id, title, date, local]) => ({
  id,
  title,
  date,
  href:
    local ??
    `https://jeffrey-hamilton-portfolio.vercel.app/assets/certificates/${id}.pdf`,
  status: "ready" as const,
}));
export const contact = {
  github: "https://github.com/JeffreyHamilton6399",
  email: "mailto:jeffreyscotthamilton6399@gmail.com",
  linkedin: "https://www.linkedin.com/in/jeffrey-s-hamilton/",
  youtube: "https://www.youtube.com/@Jeffrey_Creates/videos",
  vr: "https://www.youtube.com/@JeffreyVR6399/videos",
};
export const journey = [
  {
    year: "2018 onward",
    title: "The beginning was eggs.",
    text: "In Cedar Hills, I played soccer and sold eggs. That was the first business. Later, COVID brought a move to Lindon, and making friends in a new place took time.",
  },
  {
    year: "2022",
    title: "Make something. Put it out.",
    text: "I started a YouTube channel, taught myself Blender and editing, and built little games. I learned to finish things and put them out. There were Lindon friends, swimming, and experiments in VR and Unity along the way.",
  },
  {
    year: "2023—24",
    title: "New place. New people.",
    text: "Then came Provo, karate through a friend from Lindon, and high school in 2024. Minecraft mods and SmartChat gave me a place to learn to delegate to AI—and check what came back.",
  },
  {
    year: "Now",
    title: "A lot more than a screen.",
    text: "Friends. Group dances. Keeping in touch with the people from Lindon. I still make videos and build ideas when they come to me. Karate is a past chapter; calisthenics is something I want to try next.",
  },
];

export type AssetStatus = "ready" | "missing" | "planned" | "needs-replacement";
export type Media = {
  id: string;
  src?: string;
  alt: string;
  source: string;
  focal: string;
  status: AssetStatus;
  poster?: string;
  maskSrc?: string;
  kind?: "image" | "video";
};
export const portrait: Media = {
  id: "portrait",
  src: "/media/portrait-original.jpg",
  maskSrc: "/media/portrait-alpha.png",
  alt: "Jeffrey Hamilton smiling",
  source: "Original portfolio / assets/portrait.jpg",
  focal: "50% 45%",
  status: "ready",
};
export const portraitGeometry = {
  width: 1100,
  height: 1489,
  crop: { x: 100, y: 245, width: 900, height: 900 },
} as const;
export const gallery: Media[] = [
  ["IMG_2499", "Friends around a table"],
  ["IMG_2200", "Friends dressed up together outdoors"],
  ["IMG_2768", "Friends at the bowling alley"],
  ["IMG_6586", "Hanging out with friends"],
  ["IMG_7184", "An evening outside with friends"],
  ["IMG_7371", "Friends sharing a meal"],
  ["IMG_8200", "A day out with friends in the car"],
  ["IMG_8282", "A gathering with friends"],
  ["IMG_9223", "A group photo at the arcade"],
  ["01", "Karate team together with medals"],
  ["09", "Friends together in a hot tub"],
].map(([id, alt]) => ({
  id,
  src: `/media/${id}.jpg`,
  alt,
  source: id.startsWith("IMG")
    ? "User HEIC upload"
    : `Original portfolio / assets/friends/${id}.jpg`,
  focal: "50% 50%",
  status: "ready",
}));
export const videos: Media[] = [
  {
    id: "chest",
    src: "/media/chest.mp4",
    poster: "/media/chest-poster.jpg",
    alt: "A glowing chest opening in a Blender animation",
    source: "User upload: Chest opening blender animation.mp4",
    focal: "50% 50%",
    status: "ready",
    kind: "video",
  },
  {
    id: "speed",
    src: "/media/speed.mp4",
    poster: "/media/speed-poster.jpg",
    alt: "Gameplay recorded on a television",
    source: "User upload: The speed though.mp4",
    focal: "50% 50%",
    status: "ready",
    kind: "video",
  },
];

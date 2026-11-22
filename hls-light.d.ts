// hls.js ships no types for its light build; it's the same API, minus extras
declare module "hls.js/light" {
  export { default } from "hls.js";
  export * from "hls.js";
}

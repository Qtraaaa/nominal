window.NOMiNAL_CFG = {
  sameSec: 2,
  numberTime: { baseKST: "2026-11-01T00:00", spanDays: 21 },
  sampleNumbers: ["F3DD-VK75", "9BN5-5BSK", "C34T-UWFF"],
  logo: { svg: "logo.svg" },
  plan: {
    svg: "plan/plan.svg",
    path: "plan/path.json",
    cams: "plan/cams.json",
    trailSec: 2
  },
  demo: { code: "q6n2", normalTime: "00:05" },
  entryParam: "r",
  entry: { v: "S0", b: "S2", p: "P" },
  loops: {
    paths: [
      { dir: "loops/", ext: ".webm", type: "video/webm" },
      { dir: "loops/", ext: ".mp4", type: "video/mp4" }
    ],
    poster: { dir: "loops/poster/", ext: ".jpg" },
    suffix: "_noise",
    names: { normal: "normal", s0: "s0", v1: "v1", v2: "v2", v3: "v3" }
  },
  thumbs: { dir: "thumbs/", ext: ".jpg" },
  storageKey: "NOMiNAL.reading.v1"
};

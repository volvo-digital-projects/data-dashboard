import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Volvo Data Dashboard",
    short_name: "Data Dashboard",
    description: "Volvo Data Dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#07141d",
    theme_color: "#07141d",
    orientation: "any",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

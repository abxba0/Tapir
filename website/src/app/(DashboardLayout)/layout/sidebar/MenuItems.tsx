import {
  IconLayoutDashboard,
  IconStar,
  IconRocket,
  IconDownload,
  IconMicrophone,
  IconFileText,
  IconBrandGithub,
  IconTerminal2,
} from "@tabler/icons-react";

const Menuitems = [
  {
    navlabel: true,
    subheader: "TAPIR",
  },
  {
    id: "home",
    title: "Home",
    icon: IconLayoutDashboard,
    href: "/",
  },
  {
    id: "features",
    title: "Features",
    icon: IconStar,
    href: "/features",
  },
  {
    id: "getting-started",
    title: "Getting Started",
    icon: IconRocket,
    href: "/getting-started",
  },
  {
    navlabel: true,
    subheader: "CAPABILITIES",
  },
  {
    id: "download",
    title: "Download Media",
    icon: IconDownload,
    href: "/features#download",
  },
  {
    id: "transcribe",
    title: "Transcribe",
    icon: IconMicrophone,
    href: "/features#transcribe",
  },
  {
    id: "tts",
    title: "Text to Speech",
    icon: IconFileText,
    href: "/features#tts",
  },
  {
    id: "api",
    title: "REST API & MCP",
    icon: IconTerminal2,
    href: "/features#api",
  },
  {
    navlabel: true,
    subheader: "LINKS",
  },
  {
    id: "github",
    title: "GitHub",
    icon: IconBrandGithub,
    href: "https://github.com/abxba0/Tapir",
  },
];

export default Menuitems;

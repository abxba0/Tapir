import React from "react";
import Menuitems from "./MenuItems";
import { usePathname } from "next/navigation";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import Link from "next/link";

const SidebarItems = () => {
  const pathname = usePathname();

  return (
    <Box sx={{ px: 2, py: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 2, mb: 1 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            background: "linear-gradient(135deg, #5D87FF 0%, #49BEFF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.5px",
          }}
        >
          🦛 Tapir
        </Typography>
      </Box>
      <List sx={{ pt: 0 }}>
        {Menuitems.map((item, index) => {
          if (item.navlabel) {
            return (
              <Typography
                key={index}
                variant="caption"
                sx={{
                  px: 2,
                  pt: index === 0 ? 0 : 2,
                  pb: 0.5,
                  display: "block",
                  fontWeight: 700,
                  color: "text.secondary",
                  letterSpacing: "0.5px",
                  fontSize: "0.7rem",
                }}
              >
                {item.subheader}
              </Typography>
            );
          }

          const ItemIcon = item.icon;
          const isSelected = pathname === item.href;
          const isExternal = item.href?.startsWith("http");

          return (
            <ListItem key={item.id} disablePadding sx={{ mb: 0.3 }}>
              <ListItemButton
                component={isExternal ? "a" : Link}
                href={item.href}
                {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                sx={{
                  borderRadius: "8px",
                  py: 0.8,
                  px: 2,
                  backgroundColor: isSelected ? "primary.light" : "transparent",
                  color: isSelected ? "primary.main" : "text.primary",
                  "&:hover": {
                    backgroundColor: isSelected ? "primary.light" : "action.hover",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 36,
                    color: isSelected ? "primary.main" : "text.secondary",
                  }}
                >
                  {ItemIcon && <ItemIcon stroke={1.5} size="1.3rem" />}
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  primaryTypographyProps={{
                    fontSize: "0.875rem",
                    fontWeight: isSelected ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default SidebarItems;
